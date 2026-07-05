import { and, eq, gte, lte, sql } from 'drizzle-orm'

import { db } from '#/db/index'
import { invoices, shop, shopOrder } from '#/db/schema'
import { decryptJsonb } from './encryption.server'
import { getDac7ComplianceStatus, type Dac7Status } from './dac7.server'
import type { BillingDetails } from './invoices.server'
import { normalizeCountryCode } from './vat.server'

export interface TaxReportPeriod {
  year: number
  month?: number // 1-12; omit for annual view
}

export interface VatByCountryRate {
  buyerCountry: string
  vatRateBasisPoints: number
  netSubtotalCents: number
  vatAmountCents: number
  transactionCount: number
}

export interface ReverseChargeSummary {
  transactionCount: number
  netSubtotalCents: number
}

export interface PlatformFeeSummary {
  feeSubtotalCents: number
  feeVatCents: number
  feeTotalCents: number
  reverseChargeCount: number
  reverseChargeSubtotalCents: number
}

export interface RecentInvoice {
  invoiceNumber: string
  type: 'customer' | 'platform_fee'
  createdAt: Date
  subtotalCents: number
  vatAmountCents: number
  totalCents: number
  shopOrderId: string
}

export interface ShopTaxReport {
  shopId: string
  period: TaxReportPeriod
  dac7Status: Dac7Status
  dac7IdentityComplete: boolean
  vatByCountryRate: VatByCountryRate[]
  reverseCharge: ReverseChargeSummary
  platformFee: PlatformFeeSummary
  recentInvoices: RecentInvoice[]
}

function buildDateRange(period: TaxReportPeriod): { start: Date; end: Date } {
  const start = period.month
    ? new Date(Date.UTC(period.year, period.month - 1, 1, 0, 0, 0, 0))
    : new Date(Date.UTC(period.year, 0, 1, 0, 0, 0, 0))
  const end = period.month
    ? new Date(Date.UTC(period.year, period.month, 0, 23, 59, 59, 999))
    : new Date(Date.UTC(period.year, 11, 31, 23, 59, 59, 999))
  return { start, end }
}

/**
 * Builds a seller-facing tax/VAT report for a shop over a monthly or annual period.
 *
 * Because `invoices.billingDetails` is encrypted at rest, buyer country and the
 * reverse-charge flag are decrypted in memory and aggregated in TypeScript.
 * This keeps the encryption boundary intact while still producing correct
 * country/rate breakdowns for the seller.
 */
export async function getShopTaxReportQuery(
  shopId: string,
  period: TaxReportPeriod,
): Promise<ShopTaxReport> {
  const { start, end } = buildDateRange(period)

  const [dac7Status, shopRecord, customerInvoiceRows, platformFeeRows, recentInvoiceRows] =
    await Promise.all([
      getDac7ComplianceStatus(shopId, period.year),

      db.query.shop.findFirst({
        where: eq(shop.id, shopId),
        columns: {
          legalEntityType: true,
          dateOfBirth: true,
          taxId: true,
          businessRegistrationNumber: true,
        },
      }),

      db
        .select({
          id: invoices.id,
          billingDetails: invoices.billingDetails,
          subtotalCents: invoices.subtotalCents,
          vatAmountCents: invoices.vatAmountCents,
          vatRateBasisPoints: invoices.vatRateBasisPoints,
        })
        .from(invoices)
        .innerJoin(shopOrder, eq(invoices.shopOrderId, shopOrder.id))
        .where(
          and(
            eq(invoices.type, 'customer'),
            eq(shopOrder.shopId, shopId),
            sql`${shopOrder.status} IN ('completed', 'delivered')`,
            gte(invoices.createdAt, start),
            lte(invoices.createdAt, end),
          ),
        ),

      db
        .select({
          id: invoices.id,
          billingDetails: invoices.billingDetails,
          subtotalCents: invoices.subtotalCents,
          vatAmountCents: invoices.vatAmountCents,
          totalCents: invoices.totalCents,
        })
        .from(invoices)
        .innerJoin(shopOrder, eq(invoices.shopOrderId, shopOrder.id))
        .where(
          and(
            eq(invoices.type, 'platform_fee'),
            eq(shopOrder.shopId, shopId),
            sql`${shopOrder.status} IN ('completed', 'delivered')`,
            gte(invoices.createdAt, start),
            lte(invoices.createdAt, end),
          ),
        ),

      db
        .select({
          invoiceNumber: invoices.invoiceNumber,
          type: invoices.type,
          createdAt: invoices.createdAt,
          subtotalCents: invoices.subtotalCents,
          vatAmountCents: invoices.vatAmountCents,
          totalCents: invoices.totalCents,
          shopOrderId: invoices.shopOrderId,
        })
        .from(invoices)
        .innerJoin(shopOrder, eq(invoices.shopOrderId, shopOrder.id))
        .where(
          and(
            eq(shopOrder.shopId, shopId),
            sql`${invoices.type} IN ('customer', 'platform_fee')`,
            sql`${shopOrder.status} IN ('completed', 'delivered')`,
            gte(invoices.createdAt, start),
            lte(invoices.createdAt, end),
          ),
        )
        .orderBy(sql`${invoices.createdAt} DESC`)
        .limit(10),
    ])

  const vatMap = new Map<string, VatByCountryRate>()
  const reverseCharge: ReverseChargeSummary = {
    transactionCount: 0,
    netSubtotalCents: 0,
  }

  for (const row of customerInvoiceRows) {
    const details = decryptJsonb<BillingDetails>(row.billingDetails)
    const rawBuyerCountry = details.to.address.country ?? ''
    const buyerCountry = normalizeCountryCode(rawBuyerCountry) ?? rawBuyerCountry.toUpperCase()

    // Customer invoices store vatRateBasisPoints at 0 because items may have mixed
    // rates. Aggregate by the actual line-item rates so the report reflects the
    // correct VAT collected per country/rate combination.
    const lines = details.items.map((item) => ({
      vatRateBasisPoints: item.vatRateBasisPoints,
      netSubtotalCents: item.totalCents - item.vatAmountCents,
      vatAmountCents: item.vatAmountCents,
    }))

    if (details.shipping) {
      lines.push({
        vatRateBasisPoints: details.shipping.vatRateBasisPoints,
        netSubtotalCents: details.shipping.costCents - details.shipping.vatAmountCents,
        vatAmountCents: details.shipping.vatAmountCents,
      })
    }

    // Backward-compatible fallback for invoices created before line-item VAT
    // breakdowns were stored, or for tests that only set invoice-level totals.
    if (lines.length === 0) {
      lines.push({
        vatRateBasisPoints: row.vatRateBasisPoints,
        netSubtotalCents: row.subtotalCents,
        vatAmountCents: row.vatAmountCents,
      })
    }

    let invoiceNetSubtotalCents = 0
    for (const line of lines) {
      invoiceNetSubtotalCents += line.netSubtotalCents
      const key = `${buyerCountry}:${line.vatRateBasisPoints}`
      const existing = vatMap.get(key)
      if (existing) {
        existing.netSubtotalCents += line.netSubtotalCents
        existing.vatAmountCents += line.vatAmountCents
        existing.transactionCount += 1
      } else {
        vatMap.set(key, {
          buyerCountry,
          vatRateBasisPoints: line.vatRateBasisPoints,
          netSubtotalCents: line.netSubtotalCents,
          vatAmountCents: line.vatAmountCents,
          transactionCount: 1,
        })
      }
    }

    if (details.reverseCharge) {
      reverseCharge.transactionCount += 1
      reverseCharge.netSubtotalCents += invoiceNetSubtotalCents
    }
  }

  const platformFee: PlatformFeeSummary = {
    feeSubtotalCents: 0,
    feeVatCents: 0,
    feeTotalCents: 0,
    reverseChargeCount: 0,
    reverseChargeSubtotalCents: 0,
  }

  for (const row of platformFeeRows) {
    const details = decryptJsonb<BillingDetails>(row.billingDetails)
    platformFee.feeSubtotalCents += row.subtotalCents
    platformFee.feeVatCents += row.vatAmountCents
    platformFee.feeTotalCents += row.totalCents

    if (details.reverseCharge) {
      platformFee.reverseChargeCount += 1
      platformFee.reverseChargeSubtotalCents += row.subtotalCents
    }
  }

  const recentInvoices: RecentInvoice[] = recentInvoiceRows.map((row) => ({
    invoiceNumber: row.invoiceNumber,
    type: row.type as 'customer' | 'platform_fee',
    createdAt: row.createdAt,
    subtotalCents: row.subtotalCents,
    vatAmountCents: row.vatAmountCents,
    totalCents: row.totalCents,
    shopOrderId: row.shopOrderId,
  }))

  const dac7IdentityComplete = computeDac7IdentityComplete(shopRecord)

  return {
    shopId,
    period,
    dac7Status,
    dac7IdentityComplete,
    vatByCountryRate: Array.from(vatMap.values()).sort(
      (a, b) =>
        a.buyerCountry.localeCompare(b.buyerCountry) || a.vatRateBasisPoints - b.vatRateBasisPoints,
    ),
    reverseCharge,
    platformFee,
    recentInvoices,
  }
}

function computeDac7IdentityComplete(
  shopRecord:
    | {
        legalEntityType: string | null
        dateOfBirth: string | null
        taxId: string | null
        businessRegistrationNumber: string | null
      }
    | undefined,
): boolean {
  if (!shopRecord) return false
  const { legalEntityType, dateOfBirth, taxId, businessRegistrationNumber } = shopRecord

  if (!legalEntityType) return false
  if (!taxId || taxId.trim().length === 0) return false

  if (legalEntityType === 'individual') {
    return !!dateOfBirth && dateOfBirth.trim().length > 0
  }

  if (legalEntityType === 'business') {
    return !!businessRegistrationNumber && businessRegistrationNumber.trim().length > 0
  }

  return false
}
