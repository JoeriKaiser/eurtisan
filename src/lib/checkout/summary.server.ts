import { and, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { cart, cartItem, product, productImage, shop, user } from '#/db/schema'
import type { ShippingAddress as ProviderShippingAddress } from '#/integrations/shipping'
import { decryptJsonb } from '../encryption.server'
import {
  getSelectedShippingOption,
  getShippingOptionForVatEstimate,
  getShippingOptionsForShop,
} from './shipping.server'
import {
  calculateCheckoutLineTotals,
  calculateCheckoutShippingTotals,
  isCrossBorderB2b,
  validateCrossBorderBuyerVatId,
} from './tax.server'
import type {
  CheckoutItem,
  CheckoutShopGroup,
  CheckoutSummary,
  ShippingAddress,
  ShippingSelection,
} from './types'
import { buildShopLegalIdentity } from '../shop-legal-identity'

/**
 * Read and project a buyer-owned cart into its checkout-ready representation.
 * This module owns display-only totals and legal disclosures; authoritative
 * order persistence revalidates all prices and availability separately.
 */
export async function getCheckoutSummaryQuery(
  cartId: string,
  userId: string,
  shippingAddress?: ShippingAddress,
  shippingSelections?: ShippingSelection[],
): Promise<CheckoutSummary | null> {
  const [cartRecord] = await db.select().from(cart).where(eq(cart.id, cartId)).limit(1)
  if (!cartRecord || cartRecord.userId !== userId) {
    return null
  }

  const items = await db
    .select({
      item: cartItem,
      product,
      shop,
    })
    .from(cartItem)
    .leftJoin(product, eq(cartItem.productId, product.id))
    .leftJoin(shop, eq(product.shopId, shop.id))
    .where(eq(cartItem.cartId, cartId))

  const productIds = items.map((row) => row.product?.id).filter((id): id is string => !!id)
  const images =
    productIds.length > 0
      ? await db
          .select()
          .from(productImage)
          .where(and(inArray(productImage.productId, productIds), eq(productImage.sortOrder, 0)))
      : []

  const imageByProduct = new Map<string, string>()
  for (const image of images) {
    if (!imageByProduct.has(image.productId)) {
      imageByProduct.set(image.productId, image.url)
    }
  }

  const groups = new Map<string, CheckoutShopGroup>()
  for (const row of items) {
    const productRecord = row.product
    const shopRecord = row.shop
    const quantity = row.item.quantity

    if (
      !productRecord ||
      !shopRecord ||
      productRecord.status !== 'published' ||
      productRecord.isActive === false
    ) {
      continue
    }

    const checkoutItem: CheckoutItem = {
      productId: productRecord.id,
      name: productRecord.name,
      slug: productRecord.slug,
      priceCents: productRecord.priceCents,
      quantity,
      imageUrl: imageByProduct.get(productRecord.id) ?? null,
      weightGrams: productRecord.weightGrams ?? null,
      lengthCm: productRecord.lengthCm ?? null,
      widthCm: productRecord.widthCm ?? null,
      heightCm: productRecord.heightCm ?? null,
    }

    const existing = groups.get(shopRecord.id)
    if (existing) {
      existing.items.push(checkoutItem)
      existing.subtotalCents += productRecord.priceCents * quantity
    } else {
      groups.set(shopRecord.id, {
        shopId: shopRecord.id,
        shopName: shopRecord.name,
        shopSlug: shopRecord.slug,
        items: [checkoutItem],
        subtotalCents: productRecord.priceCents * quantity,
        vatEstimateCents: 0,
        shippingOptions: [],
        sellerLegal: buildShopLegalIdentity({
          shopName: shopRecord.name,
          ownerEmail: '',
          vatId: shopRecord.vatId,
          businessAddress: decryptJsonb(shopRecord.businessAddress),
          shippingOrigin: decryptJsonb(shopRecord.shippingOrigin),
        }),
      })
    }
  }

  const shops = Array.from(groups.values())
  const shopRecordById = new Map<string, NonNullable<(typeof items)[number]['shop']>>()
  for (const row of items) {
    if (row.shop?.id) {
      shopRecordById.set(row.shop.id, row.shop)
    }
  }

  const ownerIds = [
    ...new Set(
      shops.flatMap((shopGroup) => {
        const ownerId = shopRecordById.get(shopGroup.shopId)?.ownerId
        return ownerId ? [ownerId] : []
      }),
    ),
  ]
  const ownerRows =
    ownerIds.length > 0
      ? await db
          .select({ id: user.id, email: user.email })
          .from(user)
          .where(inArray(user.id, ownerIds as string[]))
      : []
  const ownerEmailById = new Map(ownerRows.map((row) => [row.id, row.email]))

  for (const shopGroup of shops) {
    const shopRecord = shopRecordById.get(shopGroup.shopId)
    const ownerEmail = shopRecord ? (ownerEmailById.get(shopRecord.ownerId) ?? '') : ''
    shopGroup.sellerLegal = shopRecord
      ? buildShopLegalIdentity({
          shopName: shopRecord.name,
          ownerEmail,
          vatId: shopRecord.vatId,
          businessAddress: decryptJsonb(shopRecord.businessAddress),
          shippingOrigin: decryptJsonb(shopRecord.shippingOrigin),
        })
      : {
          tradeName: shopGroup.shopName,
          contactEmail: ownerEmail,
          vatId: null,
          address: null,
        }
  }

  await Promise.all(
    shops.map(async (shopGroup) => {
      const shopRecord = shopRecordById.get(shopGroup.shopId)
      const shopOrigin = shopRecord?.shippingOrigin as ProviderShippingAddress | null
      shopGroup.shippingOptions = await getShippingOptionsForShop(
        shopGroup.items,
        shippingAddress,
        shopOrigin ?? undefined,
      )
    }),
  )

  const selectionByShopId = new Map(
    shippingSelections?.map((selection) => [selection.shopId, selection]) ?? [],
  )
  for (const shopGroup of shops) {
    const shopRecord = shopRecordById.get(shopGroup.shopId)
    if (!shopRecord) continue

    const sellerCountry = (shopRecord.shippingOrigin as { country?: string } | null)?.country ?? ''
    const buyerCountry = shippingAddress?.country ?? ''
    const reverseChargeApplies = isCrossBorderB2b(
      sellerCountry,
      buyerCountry,
      shopRecord.isVatRegistered,
      shippingAddress?.vatId,
    )

    if (reverseChargeApplies) {
      await validateCrossBorderBuyerVatId(
        sellerCountry,
        buyerCountry,
        shopRecord.isVatRegistered,
        shippingAddress?.vatId,
      )
    }

    let vatEstimateCents = 0
    let adjustedSubtotalCents = 0
    for (const row of items) {
      if (row.shop?.id !== shopGroup.shopId || !row.product) continue

      const lineTotals = calculateCheckoutLineTotals({
        sellerCountry,
        buyerCountry,
        isSellerVatRegistered: shopRecord.isVatRegistered,
        buyerVatId: shippingAddress?.vatId,
        reverseChargeApplies,
        vatRateCategory:
          (row.product.vatRateCategory as 'standard' | 'reduced' | 'exempt') ?? 'standard',
        unitPriceCents: row.product.priceCents,
        quantity: row.item.quantity,
      })
      adjustedSubtotalCents += lineTotals.lineTotalCents
      vatEstimateCents += lineTotals.vatAmountCents
    }

    shopGroup.subtotalCents = adjustedSubtotalCents

    const selectedOption = getShippingOptionForVatEstimate(
      shopGroup.shippingOptions,
      selectionByShopId.get(shopGroup.shopId),
    )
    if (selectedOption && selectedOption.costCents > 0) {
      const shippingTotals = calculateCheckoutShippingTotals({
        sellerCountry,
        buyerCountry,
        isSellerVatRegistered: shopRecord.isVatRegistered,
        buyerVatId: shippingAddress?.vatId,
        reverseChargeApplies,
        shippingCostCents: selectedOption.costCents,
      })
      selectedOption.costCents = shippingTotals.shippingCostCents
      vatEstimateCents += shippingTotals.vatAmountCents
    }

    shopGroup.vatEstimateCents = vatEstimateCents
  }

  const grandTotalCents = shops.reduce((sum, shopGroup) => {
    const selection = shippingSelections?.find((candidate) => candidate.shopId === shopGroup.shopId)
    const selectedOption = getSelectedShippingOption(shopGroup.shippingOptions, selection)
    return sum + shopGroup.subtotalCents + (selectedOption?.costCents ?? 0)
  }, 0)

  return {
    cartId,
    shops,
    grandTotalCents,
  }
}
