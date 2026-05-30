import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { invoices, platformOrder, shopOrder, orderItem, shop, user } from '#/db/schema'
import { normalizeCountryCode } from './vat.server'

export interface BillingAddress {
  name: string
  street: string
  city: string
  postalCode: string
  country: string
}

export interface BillingParty {
  name: string
  email?: string
  vatId?: string | null
  isVatRegistered?: boolean
  address: {
    street?: string
    city?: string
    postalCode?: string
    country: string
  }
}

export interface InvoiceLineItem {
  id: string
  name: string
  quantity: number
  unitPriceCents: number
  totalCents: number
  vatRateBasisPoints: number
  vatAmountCents: number
}

export interface BillingDetails {
  from: BillingParty
  to: BillingParty
  items: InvoiceLineItem[]
  shipping?: {
    costCents: number
    vatRateBasisPoints: number
    vatAmountCents: number
    method: string
  }
  reverseCharge?: boolean
}

const EURTISAN_BILLING_PARTY: BillingParty = {
  name: 'Joeri Kaiser (Eurtisan)',
  email: 'billing@eurtisan.com',
  vatId: 'FR86123456789',
  address: {
    street: '5 Chemin de Gramont',
    city: 'Toulouse',
    postalCode: '31200',
    country: 'FR',
  },
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

  if (buyerCode === 'FR') {
    // Domestic B2B: Under the "Franchise en base de TVA" regime, no VAT is charged.
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

  // Under franchise en base de TVA, the subtotal equals the total because no VAT is charged (TVA non applicable)
  const subtotalCents = inclusiveAmountCents
  const vatAmountCents = 0

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
  tx?: any,
): Promise<void> {
  const activeDb = tx ?? db

  // 1. Fetch platform order with buyer user details
  const [orderRecord] = await activeDb
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

  const [buyerUser] = await activeDb
    .select({
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, orderRecord.userId))
    .limit(1)

  const billingAddr = orderRecord.billingAddress as BillingAddress
  const buyerParty: BillingParty = {
    name: billingAddr.name,
    email: buyerUser?.email,
    address: {
      street: billingAddr.street,
      city: billingAddr.city,
      postalCode: billingAddr.postalCode,
      country: billingAddr.country,
    },
  }

  // 2. Fetch all shop orders under this platform order
  const shopOrdersList = await activeDb
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.platformOrderId, platformOrderId))

  await Promise.all(
    shopOrdersList.map(async (so: typeof shopOrder.$inferSelect) => {
      // 3. Fetch shop and its owner details
      const [shopRecord] = await activeDb.select().from(shop).where(eq(shop.id, so.shopId)).limit(1)

      if (!shopRecord) {
        throw new Error(`Shop ${so.shopId} not found`)
      }

      const [ownerUser] = await activeDb
        .select({
          name: user.name,
          email: user.email,
        })
        .from(user)
        .where(eq(user.id, shopRecord.ownerId))
        .limit(1)

      const shopOrigin = shopRecord.shippingOrigin as {
        street?: string
        city?: string
        postalCode?: string
        country?: string
      } | null

      const shopParty: BillingParty = {
        name: shopRecord.name,
        email: ownerUser?.email,
        vatId: shopRecord.vatId,
        isVatRegistered: shopRecord.isVatRegistered,
        address: {
          street: shopOrigin?.street,
          city: shopOrigin?.city,
          postalCode: shopOrigin?.postalCode,
          country: shopOrigin?.country ?? '',
        },
      }

      // 4. Fetch order items for this shop order
      const itemsList = await activeDb
        .select()
        .from(orderItem)
        .where(eq(orderItem.shopOrderId, so.id))

      // ─── A. GENERATE CUSTOMER INVOICE ───
      const customerInvoiceNumber = `INV-${so.id.toUpperCase()}`

      // Calculate total net from items and shipping
      const totalGross = so.subtotalCents + so.shippingCostCents
      const totalVat = so.vatAmountCents + so.shippingVatAmountCents
      const totalNet = totalGross - totalVat

      const customerInvoiceLines: InvoiceLineItem[] = itemsList.map((item: any) => ({
        id: item.productId,
        name: item.productName,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalCents: item.totalCents,
        vatRateBasisPoints: item.vatRateBasisPoints,
        vatAmountCents: item.vatAmountCents,
      }))

      const customerBillingDetails: BillingDetails = {
        from: shopParty,
        to: buyerParty,
        items: customerInvoiceLines,
        shipping: {
          costCents: so.shippingCostCents,
          vatRateBasisPoints: so.shippingVatRateBasisPoints,
          vatAmountCents: so.shippingVatAmountCents,
          method: so.shippingMethod,
        },
      }

      await activeDb
        .insert(invoices)
        .values({
          invoiceNumber: customerInvoiceNumber,
          type: 'customer',
          shopOrderId: so.id,
          subtotalCents: totalNet,
          vatAmountCents: totalVat,
          totalCents: totalGross,
          vatRateBasisPoints: 0, // Mix of rates possible, detail is in items snapshot
          billingDetails: customerBillingDetails,
        })
        .onConflictDoNothing() // Idempotency fallback

      // ─── B. GENERATE PLATFORM FEE INVOICE ───
      const platformFeeInvoiceNumber = `INV-FEE-${so.id.toUpperCase()}`
      const rawFeeCents = Math.round(so.subtotalCents * 0.1) // 10% commission

      const feeVatDetails = calculatePlatformFeeVat(
        shopOrigin?.country ?? '',
        shopRecord.isVatRegistered && !!shopRecord.vatId,
        rawFeeCents,
      )

      const platformBillingDetails: BillingDetails = {
        from: EURTISAN_BILLING_PARTY,
        to: {
          ...shopParty,
          name: `${shopParty.name} (c/o ${ownerUser?.name || 'Owner'})`,
        },
        items: [
          {
            id: 'platform-commission',
            name: `Eurtisan Platform Commission Fee (10% on Sale Subtotal ${so.subtotalCents / 100} EUR)`,
            quantity: 1,
            unitPriceCents: feeVatDetails.totalCents,
            totalCents: feeVatDetails.totalCents,
            vatRateBasisPoints: feeVatDetails.vatRateBasisPoints,
            vatAmountCents: feeVatDetails.vatAmountCents,
          },
        ],
        reverseCharge: feeVatDetails.reverseCharge,
      }

      await activeDb
        .insert(invoices)
        .values({
          invoiceNumber: platformFeeInvoiceNumber,
          type: 'platform_fee',
          shopOrderId: so.id,
          subtotalCents: feeVatDetails.subtotalCents,
          vatAmountCents: feeVatDetails.vatAmountCents,
          totalCents: feeVatDetails.totalCents,
          vatRateBasisPoints: feeVatDetails.vatRateBasisPoints,
          billingDetails: platformBillingDetails,
        })
        .onConflictDoNothing() // Idempotency fallback
    }),
  )
}

/**
 * Retrieves an invoice and validates user permissions.
 */
export async function getInvoiceByIdQuery(
  invoiceNumber: string,
  userId: string,
  userRole: 'customer' | 'creator' | 'admin',
): Promise<any> {
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
