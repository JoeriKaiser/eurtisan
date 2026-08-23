import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  invoiceNumberSequence,
  invoices,
  platformOrder,
  shopOrder,
  orderItem,
  shop,
  user,
} from '#/db/schema'
import { normalizeCountryCode, getStandardVatRate } from '../vat.server'
import { PLATFORM_FEE_PERCENT } from '../platform-constants'
import { getPlatformVatLiable } from '../env.server'
import { getOperatorBillingParty } from '#/lib/legal/operator.server'
import { decryptJsonb, encryptJsonb } from '../encryption.server'
import { logger } from '../logger.server'
import { SUPPORTED_CURRENCY } from '../currency'
import type {
  BillingAddress,
  BillingDetails,
  BillingParty,
  CreatedInvoiceNumbers,
  InvoiceLineItem,
  InvoiceRecord,
} from './types'

/**
 * Allocates the next sequential number for an invoice prefix.
 * The format is `{PREFIX}-{YYYY}-{00001}`.
 */
async function allocateNextInvoiceNumber(
  tx: Omit<typeof db, '$client'>,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear()
  const [row] = await tx
    .insert(invoiceNumberSequence)
    .values({ prefix, lastNumber: 1 })
    .onConflictDoUpdate({
      target: invoiceNumberSequence.prefix,
      set: {
        lastNumber: sql`${invoiceNumberSequence.lastNumber} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ lastNumber: invoiceNumberSequence.lastNumber })

  if (!row) {
    throw new Error(`Failed to allocate invoice number for prefix ${prefix}`)
  }

  return `${prefix}-${year}-${String(row.lastNumber).padStart(5, '0')}`
}

function isReverseChargeCustomerInvoice(
  sellerCountry: string,
  buyerCountry: string,
  isSellerVatRegistered: boolean,
  buyerVatId?: string | null,
): boolean {
  if (!isSellerVatRegistered || !buyerVatId) return false
  const sellerCode = normalizeCountryCode(sellerCountry)
  const buyerCode = normalizeCountryCode(buyerCountry)
  if (!sellerCode || !buyerCode || sellerCode === buyerCode) return false

  const euCountries = [
    'AT',
    'BE',
    'BG',
    'CY',
    'CZ',
    'DE',
    'DK',
    'EE',
    'EL',
    'ES',
    'FI',
    'FR',
    'GR',
    'HR',
    'HU',
    'IE',
    'IT',
    'LT',
    'LU',
    'LV',
    'MT',
    'NL',
    'PL',
    'PT',
    'RO',
    'SE',
    'SI',
    'SK',
  ]
  return euCountries.includes(sellerCode) && euCountries.includes(buyerCode)
}

/**
 * Calculates the platform fee commission VAT using EU B2B/B2C rules.
 * Eurtisan is established in France (FR) as a micro-entreprise under the "Franchise en base de TVA" regime.
 */
export function calculatePlatformFeeVat(
  buyerCountry: string,
  isBuyerVatRegistered: boolean,
  inclusiveAmountCents: number,
): {
  vatRateBasisPoints: number
  vatAmountCents: number
  subtotalCents: number
  totalCents: number
  reverseCharge: boolean
} {
  const buyerCode = normalizeCountryCode(buyerCountry)
  if (!buyerCode && buyerCountry.trim() !== '') {
    // Fall open for unrecognized seller/buyer country names instead of blocking invoice
    // generation. This protects against malformed legacy or seed address data.
    logger.warn('Unrecognized country in platform fee VAT calculation; treating as non-EU export', {
      country: buyerCountry,
    })
  }
  const isEU =
    buyerCode &&
    buyerCode !== 'GB' &&
    [
      'AT',
      'BE',
      'BG',
      'CY',
      'CZ',
      'DE',
      'DK',
      'EE',
      'EL',
      'ES',
      'FI',
      'FR',
      'GR',
      'HR',
      'HU',
      'IE',
      'IT',
      'LT',
      'LU',
      'LV',
      'MT',
      'NL',
      'PL',
      'PT',
      'RO',
      'SE',
      'SI',
      'SK',
    ].includes(buyerCode)

  let vatRateBasisPoints = 0
  let reverseCharge = false
  const platformVatLiable = getPlatformVatLiable()

  if (platformVatLiable) {
    if (buyerCode === 'FR') {
      // Domestic: Eurtisan charges standard French VAT (20%)
      vatRateBasisPoints = 2000
    } else if (isEU) {
      if (isBuyerVatRegistered) {
        // Cross-Border EU B2B: Reverse charge (0% VAT)
        vatRateBasisPoints = 0
        reverseCharge = true
      } else {
        // Cross-Border EU B2C: OSS VAT (rate of the destination EU country)
        vatRateBasisPoints = getStandardVatRate(buyerCountry)
      }
    } else {
      // Export (outside EU): VAT-exempt (0% VAT)
      vatRateBasisPoints = 0
    }
  } else {
    // Under Franchise en base de TVA
    if (buyerCode === 'FR') {
      // Domestic B2B/B2C: Under the "Franchise en base de TVA" regime, no VAT is charged.
      vatRateBasisPoints = 0
    } else if (isEU) {
      if (isBuyerVatRegistered) {
        // Cross-Border EU B2B: Reverse charge (0% VAT)
        vatRateBasisPoints = 0
        reverseCharge = true
      } else {
        // Cross-Border EU B2C: Under the "Franchise en base de TVA" regime, no VAT is charged.
        vatRateBasisPoints = 0
      }
    } else {
      // Export (outside EU): VAT-exempt (0% VAT)
      vatRateBasisPoints = 0
    }
  }

  // Base exclusive price: Round to nearest cent to ensure base + vat equals total exactly
  const baseAmountCents = Math.round((inclusiveAmountCents * 10000) / (10000 + vatRateBasisPoints))
  const vatAmountCents = inclusiveAmountCents - baseAmountCents
  const subtotalCents = baseAmountCents

  return {
    vatRateBasisPoints,
    vatAmountCents,
    subtotalCents,
    totalCents: inclusiveAmountCents,
    reverseCharge,
  }
}

/**
 * Automatically generates customer and platform fee invoices for all shop orders under a platform order.
 * This is designed to run inside a database transaction when the payment goes through.
 */
export async function createInvoicesForPlatformOrder(
  platformOrderId: string,
  tx: Omit<typeof db, '$client'> = db,
): Promise<Map<string, CreatedInvoiceNumbers>> {
  // 1. Fetch platform order with buyer user details
  const [orderRecord] = await tx
    .select({
      id: platformOrder.id,
      userId: platformOrder.userId,
      billingAddress: platformOrder.billingAddress,
    })
    .from(platformOrder)
    .where(eq(platformOrder.id, platformOrderId))
    .limit(1)

  if (!orderRecord) {
    throw new Error(`Platform order ${platformOrderId} not found`)
  }

  const [buyerUser] = await tx
    .select({
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, orderRecord.userId))
    .limit(1)

  const billingAddr = decryptJsonb<BillingAddress>(orderRecord.billingAddress)
  const buyerParty: BillingParty = {
    name: billingAddr?.name || buyerUser?.name || 'Customer',
    email: buyerUser?.email,
    vatId: billingAddr?.vatId,
    isVatRegistered: !!billingAddr?.vatId,
    address: {
      street: billingAddr?.street,
      city: billingAddr?.city,
      postalCode: billingAddr?.postalCode,
      country: billingAddr?.country || '',
    },
  }

  // 2. Fetch all shop orders under this platform order
  const shopOrdersList = (await tx
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.platformOrderId, platformOrderId))) as (typeof shopOrder.$inferSelect)[]

  if (shopOrdersList.length === 0) {
    return new Map()
  }

  // 3. Batch-fetch shops, owners, and order items to avoid N+1 queries
  const shopIds = Array.from(new Set(shopOrdersList.map((so) => so.shopId)))
  const shopOrderIds = shopOrdersList.map((so) => so.id)

  const shopsList =
    shopIds.length > 0
      ? ((await tx
          .select()
          .from(shop)
          .where(inArray(shop.id, shopIds))) as (typeof shop.$inferSelect)[])
      : []
  const shopsById = new Map(shopsList.map((s) => [s.id, s]))

  const ownerIds = Array.from(new Set(shopsList.map((s) => s.ownerId)))
  const ownersList =
    ownerIds.length > 0
      ? await tx
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
          })
          .from(user)
          .where(inArray(user.id, ownerIds))
      : []
  const ownersById = new Map<string, { id: string; name: string | null; email: string }>(
    ownersList.map((u: { id: string; name: string | null; email: string }) => [u.id, u]),
  )

  const allItemsList =
    shopOrderIds.length > 0
      ? await tx.select().from(orderItem).where(inArray(orderItem.shopOrderId, shopOrderIds))
      : []
  const itemsByShopOrderId = new Map<string, typeof allItemsList>()
  for (const item of allItemsList) {
    const list = itemsByShopOrderId.get(item.shopOrderId)
    if (list) {
      list.push(item)
    } else {
      itemsByShopOrderId.set(item.shopOrderId, [item])
    }
  }

  const created = new Map<string, CreatedInvoiceNumbers>()

  // Sequential invoice number allocation prevents races and guarantees
  // strictly increasing numbers within a prefix. Do not parallelize.
  for (const so of shopOrdersList) {
    const shopRecord = shopsById.get(so.shopId)

    if (!shopRecord) {
      throw new Error(`Shop ${so.shopId} not found`)
    }

    const ownerUser = ownersById.get(shopRecord.ownerId)

    // Both encrypted at rest. Read raw, the seller's address on a VAT invoice
    // comes out entirely blank — including `country`, which also feeds the
    // reverse-charge determination below.
    const shopOrigin = decryptJsonb<{
      street?: string
      city?: string
      postalCode?: string
      country?: string
    } | null>(shopRecord.shippingOrigin)

    const shopBusinessAddress = decryptJsonb<{
      street?: string
      city?: string
      postalCode?: string
      country?: string
    } | null>(shopRecord.businessAddress)

    const shopAddress = shopBusinessAddress ?? shopOrigin

    const shopParty: BillingParty = {
      name: shopRecord.name,
      email: ownerUser?.email,
      vatId: shopRecord.vatId,
      isVatRegistered: shopRecord.isVatRegistered,
      address: {
        street: shopAddress?.street,
        city: shopAddress?.city,
        postalCode: shopAddress?.postalCode,
        country: shopAddress?.country ?? '',
      },
    }

    // 4. Lookup order items from pre-fetched batch
    const itemsList = itemsByShopOrderId.get(so.id) ?? []

    // ─── A. GENERATE CUSTOMER INVOICE ───
    const customerInvoiceNumber = await allocateNextInvoiceNumber(tx, 'INV')

    // Calculate total net from items and shipping
    const totalGross = so.subtotalCents + so.shippingCostCents
    const totalVat = so.vatAmountCents + so.shippingVatAmountCents
    const totalNet = totalGross - totalVat

    const customerReverseCharge = isReverseChargeCustomerInvoice(
      shopAddress?.country ?? '',
      billingAddr.country,
      shopRecord.isVatRegistered && !!shopRecord.vatId,
      billingAddr.vatId,
    )

    const finalVatAmount = customerReverseCharge ? 0 : totalVat
    const finalSubtotal = customerReverseCharge ? totalGross : totalNet

    const customerInvoiceLines: InvoiceLineItem[] = itemsList.map((item) => ({
      id: item.productId,
      name: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: item.totalCents,
      vatRateBasisPoints: customerReverseCharge ? 0 : item.vatRateBasisPoints,
      vatAmountCents: customerReverseCharge ? 0 : item.vatAmountCents,
    }))

    const customerBillingDetails: BillingDetails = {
      from: shopParty,
      to: buyerParty,
      items: customerInvoiceLines,
      shipping: {
        costCents: so.shippingCostCents,
        vatRateBasisPoints: customerReverseCharge ? 0 : so.shippingVatRateBasisPoints,
        vatAmountCents: customerReverseCharge ? 0 : so.shippingVatAmountCents,
        method: so.shippingMethod,
      },
      reverseCharge: customerReverseCharge,
    }

    await tx
      .insert(invoices)
      .values({
        invoiceNumber: customerInvoiceNumber,
        type: 'customer',
        shopOrderId: so.id,
        subtotalCents: finalSubtotal,
        vatAmountCents: finalVatAmount,
        totalCents: totalGross,
        vatRateBasisPoints: 0, // Mix of rates possible, detail is in items snapshot
        billingDetails: encryptJsonb(customerBillingDetails),
      })
      .onConflictDoNothing() // Idempotency fallback

    created.set(so.id, { customerInvoiceNumber, platformFeeInvoiceNumber: '' })

    // ─── B. GENERATE PLATFORM FEE INVOICE ───
    const platformFeeInvoiceNumber = await allocateNextInvoiceNumber(tx, 'INV-FEE')
    const netSubtotalCents = so.subtotalCents - so.vatAmountCents
    const rawFeeCents = Math.round(netSubtotalCents * (PLATFORM_FEE_PERCENT / 100))

    const feeVatDetails = calculatePlatformFeeVat(
      shopBusinessAddress?.country ?? shopOrigin?.country ?? '',
      shopRecord.isVatRegistered && !!shopRecord.vatId,
      rawFeeCents,
    )

    const platformBillingDetails: BillingDetails = {
      from: getOperatorBillingParty(),
      to: {
        ...shopParty,
        name: `${shopParty.name} (c/o ${ownerUser?.name || 'Owner'})`,
      },
      items: [
        {
          id: 'platform-commission',
          name: `Eurtisan Platform Commission Fee (${PLATFORM_FEE_PERCENT}% on Sale Subtotal ${netSubtotalCents / 100} ${SUPPORTED_CURRENCY})`,
          quantity: 1,
          unitPriceCents: feeVatDetails.totalCents,
          totalCents: feeVatDetails.totalCents,
          vatRateBasisPoints: feeVatDetails.vatRateBasisPoints,
          vatAmountCents: feeVatDetails.vatAmountCents,
        },
      ],
      reverseCharge: feeVatDetails.reverseCharge,
    }

    await tx
      .insert(invoices)
      .values({
        invoiceNumber: platformFeeInvoiceNumber,
        type: 'platform_fee',
        shopOrderId: so.id,
        subtotalCents: feeVatDetails.subtotalCents,
        vatAmountCents: feeVatDetails.vatAmountCents,
        totalCents: feeVatDetails.totalCents,
        vatRateBasisPoints: feeVatDetails.vatRateBasisPoints,
        billingDetails: encryptJsonb(platformBillingDetails),
      })
      .onConflictDoNothing() // Idempotency fallback

    created.set(so.id, { customerInvoiceNumber, platformFeeInvoiceNumber })
  }

  return created
}

/**
 * Creates a credit note that cancels the original customer invoice for a shop order.
 * The credit note uses the same billing details with negated amounts and links back
 * to the original invoice number.
 */
export async function createCreditNoteForShopOrder(
  shopOrderId: string,
  tx: Omit<typeof db, '$client'> = db,
  amountCents?: number,
): Promise<string | null> {
  // Full credit notes are idempotent; partial credit notes may be created
  // multiple times for the same shop order (e.g. staged refunds).
  if (!amountCents) {
    const [existingCreditNote] = await tx
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.shopOrderId, shopOrderId), eq(invoices.type, 'credit_note')))
      .limit(1)

    if (existingCreditNote) {
      return existingCreditNote.invoiceNumber
    }
  }

  const [original] = await tx
    .select({
      invoiceNumber: invoices.invoiceNumber,
      billingDetails: invoices.billingDetails,
      subtotalCents: invoices.subtotalCents,
      vatAmountCents: invoices.vatAmountCents,
      totalCents: invoices.totalCents,
      vatRateBasisPoints: invoices.vatRateBasisPoints,
    })
    .from(invoices)
    .where(and(eq(invoices.shopOrderId, shopOrderId), eq(invoices.type, 'customer')))
    .limit(1)

  if (!original) {
    return null
  }

  const creditNoteNumber = await allocateNextInvoiceNumber(tx, 'CN')
  const originalBillingDetails = decryptJsonb<BillingDetails>(original.billingDetails)

  const refundTotalCents = amountCents ?? original.totalCents
  let subtotalCents = original.subtotalCents
  let vatAmountCents = original.vatAmountCents

  if (amountCents && original.totalCents > 0) {
    const ratio = amountCents / original.totalCents
    subtotalCents = Math.round(original.subtotalCents * ratio)
    vatAmountCents = Math.round(original.vatAmountCents * ratio)
  }

  await tx.insert(invoices).values({
    invoiceNumber: creditNoteNumber,
    type: 'credit_note',
    shopOrderId,
    originalInvoiceNumber: original.invoiceNumber,
    subtotalCents: -subtotalCents,
    vatAmountCents: -vatAmountCents,
    totalCents: -refundTotalCents,
    vatRateBasisPoints: original.vatRateBasisPoints,
    billingDetails: encryptJsonb(originalBillingDetails),
  })

  return creditNoteNumber
}

/**
 * Retrieves an invoice and validates user permissions.
 */
export async function getInvoicePlatformOrderIdQuery(
  invoiceNumber: string,
): Promise<string | null> {
  const [record] = await db
    .select({ platformOrderId: shopOrder.platformOrderId })
    .from(invoices)
    .innerJoin(shopOrder, eq(invoices.shopOrderId, shopOrder.id))
    .where(eq(invoices.invoiceNumber, invoiceNumber))
    .limit(1)
  return record?.platformOrderId ?? null
}

export async function getInvoiceByIdQuery(
  invoiceNumber: string,
  userId: string,
  userRole: 'customer' | 'creator' | 'admin',
): Promise<InvoiceRecord> {
  const [invoiceRecord] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      type: invoices.type,
      shopOrderId: invoices.shopOrderId,
      createdAt: invoices.createdAt,
      subtotalCents: invoices.subtotalCents,
      vatAmountCents: invoices.vatAmountCents,
      totalCents: invoices.totalCents,
      vatRateBasisPoints: invoices.vatRateBasisPoints,
      billingDetails: invoices.billingDetails,
    })
    .from(invoices)
    .where(eq(invoices.invoiceNumber, invoiceNumber))
    .limit(1)

  if (!invoiceRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Invoice not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Admin has access to all invoices
  if (userRole === 'admin') {
    return invoiceRecord
  }

  // Fetch shop order to verify relationships
  const [soRecord] = await db
    .select({
      id: shopOrder.id,
      shopId: shopOrder.shopId,
      platformOrderId: shopOrder.platformOrderId,
    })
    .from(shopOrder)
    .where(eq(shopOrder.id, invoiceRecord.shopOrderId))
    .limit(1)

  if (!soRecord) {
    throw new Response(
      JSON.stringify({ error: 'Internal Error', message: 'Invoice details are corrupted.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (userRole === 'creator') {
    // Verify shop ownership
    const [shopRecord] = await db
      .select({ ownerId: shop.ownerId })
      .from(shop)
      .where(eq(shop.id, soRecord.shopId))
      .limit(1)

    if (!shopRecord || shopRecord.ownerId !== userId) {
      throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return invoiceRecord
  }

  if (userRole === 'customer') {
    // Customers can only access "customer" invoices, not "platform_fee" invoices
    if (invoiceRecord.type !== 'customer') {
      throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verify order owner matches buyer
    const [poRecord] = await db
      .select({ userId: platformOrder.userId })
      .from(platformOrder)
      .where(eq(platformOrder.id, soRecord.platformOrderId))
      .limit(1)

    if (!poRecord || poRecord.userId !== userId) {
      throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return invoiceRecord
  }

  throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied.' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}
