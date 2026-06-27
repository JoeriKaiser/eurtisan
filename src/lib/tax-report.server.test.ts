import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { clearTestTables } from '#/test/cleanup'
import {
  createInvoice,
  createPlatformOrder,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import type { BillingDetails } from './invoices.server'
import { getShopTaxReportQuery } from './tax-report.server'

function makeCustomerBillingDetails(country: string, reverseCharge = false): BillingDetails {
  return {
    from: {
      name: 'Test Shop',
      address: { country: 'FR' },
    },
    to: {
      name: 'Test Buyer',
      address: { country },
    },
    items: [],
    reverseCharge,
  }
}

function makePlatformFeeBillingDetails(reverseCharge = false): BillingDetails {
  return {
    from: {
      name: 'Eurtisan',
      address: { country: 'FR' },
    },
    to: {
      name: 'Test Shop',
      address: { country: 'FR' },
    },
    items: [],
    reverseCharge,
  }
}

describe.sequential('Shop Tax Report', () => {
  const currentYear = new Date().getFullYear()

  beforeEach(async () => {
    await clearTestTables()

    const creator = await createUser({
      id: 'creator-user',
      name: 'Alice Artisan',
      email: 'alice@artisan.de',
      role: 'creator',
    })

    await createShop(creator, {
      id: 'shop-1',
      name: 'Alice Store',
      slug: 'alice-store',
      isVatRegistered: true,
      vatId: 'FR12345678901',
      legalEntityType: 'individual',
      dateOfBirth: '1990-01-01',
      taxId: '1234567890',
    })

    await createUser({
      id: 'buyer-user',
      name: 'Bob Buyer',
      email: 'bob@buyer.com',
      role: 'customer',
    })
  })

  afterAll(async () => {
    await clearTestTables()
  })

  it('returns an empty report when the shop has no invoices', async () => {
    const report = await getShopTaxReportQuery('shop-1', { year: currentYear })

    expect(report.shopId).toBe('shop-1')
    expect(report.period).toEqual({ year: currentYear })
    expect(report.dac7Status.transactionCount).toBe(0)
    expect(report.dac7Status.grossSalesCents).toBe(0)
    expect(report.dac7IdentityComplete).toBe(true)
    expect(report.vatByCountryRate).toEqual([])
    expect(report.reverseCharge).toEqual({ transactionCount: 0, netSubtotalCents: 0 })
    expect(report.platformFee).toEqual({
      feeSubtotalCents: 0,
      feeVatCents: 0,
      feeTotalCents: 0,
      reverseChargeCount: 0,
      reverseChargeSubtotalCents: 0,
    })
    expect(report.recentInvoices).toEqual([])
  })

  it('includes only completed and delivered shop orders', async () => {
    const platformOrder = await createPlatformOrder('buyer-user', {
      id: 'a1111111-1111-1111-1111-111111111111',
      totalCents: 5000,
      status: 'paid',
    })

    const completedOrder = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b1111111-1111-1111-1111-111111111111',
      status: 'completed',
      subtotalCents: 2000,
      createdAt: new Date(`${currentYear}-06-15T12:00:00Z`),
    })

    const deliveredOrder = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b2222222-2222-2222-2222-222222222222',
      status: 'delivered',
      subtotalCents: 1000,
      createdAt: new Date(`${currentYear}-07-15T12:00:00Z`),
    })

    await createShopOrder(platformOrder, 'shop-1', {
      id: 'b3333333-3333-3333-3333-333333333333',
      status: 'pending_payment',
      subtotalCents: 5000,
      createdAt: new Date(`${currentYear}-08-15T12:00:00Z`),
    })

    await createInvoice(completedOrder, {
      invoiceNumber: 'INV-2026-00001',
      type: 'customer',
      subtotalCents: 1800,
      vatAmountCents: 200,
      totalCents: 2000,
      vatRateBasisPoints: 2000,
      billingDetails: makeCustomerBillingDetails('DE'),
      createdAt: new Date(`${currentYear}-06-15T12:00:00Z`),
    })

    await createInvoice(deliveredOrder, {
      invoiceNumber: 'INV-2026-00002',
      type: 'customer',
      subtotalCents: 900,
      vatAmountCents: 100,
      totalCents: 1000,
      vatRateBasisPoints: 2000,
      billingDetails: makeCustomerBillingDetails('DE'),
      createdAt: new Date(`${currentYear}-07-15T12:00:00Z`),
    })

    const report = await getShopTaxReportQuery('shop-1', { year: currentYear })
    expect(report.vatByCountryRate).toHaveLength(1)
    expect(report.vatByCountryRate[0]).toEqual({
      buyerCountry: 'DE',
      vatRateBasisPoints: 2000,
      netSubtotalCents: 2700,
      vatAmountCents: 300,
      transactionCount: 2,
    })
  })

  it('filters invoices by month', async () => {
    const platformOrder = await createPlatformOrder('buyer-user', {
      id: 'a1111111-1111-1111-1111-111111111111',
      totalCents: 5000,
      status: 'paid',
    })

    const juneOrder = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b1111111-1111-1111-1111-111111111111',
      status: 'completed',
      subtotalCents: 2000,
      createdAt: new Date(`${currentYear}-06-15T12:00:00Z`),
    })

    const julyOrder = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b2222222-2222-2222-2222-222222222222',
      status: 'completed',
      subtotalCents: 1000,
      createdAt: new Date(`${currentYear}-07-15T12:00:00Z`),
    })

    await createInvoice(juneOrder, {
      invoiceNumber: 'INV-2026-00001',
      type: 'customer',
      subtotalCents: 1800,
      vatAmountCents: 200,
      totalCents: 2000,
      vatRateBasisPoints: 2000,
      billingDetails: makeCustomerBillingDetails('DE'),
      createdAt: new Date(`${currentYear}-06-15T12:00:00Z`),
    })

    await createInvoice(julyOrder, {
      invoiceNumber: 'INV-2026-00002',
      type: 'customer',
      subtotalCents: 900,
      vatAmountCents: 100,
      totalCents: 1000,
      vatRateBasisPoints: 2000,
      billingDetails: makeCustomerBillingDetails('DE'),
      createdAt: new Date(`${currentYear}-07-15T12:00:00Z`),
    })

    const juneReport = await getShopTaxReportQuery('shop-1', { year: currentYear, month: 6 })
    expect(juneReport.vatByCountryRate).toHaveLength(1)
    expect(juneReport.vatByCountryRate[0].transactionCount).toBe(1)
    expect(juneReport.vatByCountryRate[0].netSubtotalCents).toBe(1800)

    const julyReport = await getShopTaxReportQuery('shop-1', { year: currentYear, month: 7 })
    expect(julyReport.vatByCountryRate).toHaveLength(1)
    expect(julyReport.vatByCountryRate[0].transactionCount).toBe(1)
    expect(julyReport.vatByCountryRate[0].netSubtotalCents).toBe(900)
  })

  it('groups VAT by buyer country and rate', async () => {
    const platformOrder = await createPlatformOrder('buyer-user', {
      id: 'a1111111-1111-1111-1111-111111111111',
      totalCents: 10000,
      status: 'paid',
    })

    const orderDe = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b1111111-1111-1111-1111-111111111111',
      status: 'completed',
      subtotalCents: 2000,
      createdAt: new Date(`${currentYear}-03-15T12:00:00Z`),
    })

    const orderFr = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b2222222-2222-2222-2222-222222222222',
      status: 'completed',
      subtotalCents: 1000,
      createdAt: new Date(`${currentYear}-03-20T12:00:00Z`),
    })

    const orderDeReduced = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b3333333-3333-3333-3333-333333333333',
      status: 'completed',
      subtotalCents: 500,
      createdAt: new Date(`${currentYear}-03-25T12:00:00Z`),
    })

    await createInvoice(orderDe, {
      invoiceNumber: 'INV-2026-00001',
      type: 'customer',
      subtotalCents: 1800,
      vatAmountCents: 200,
      totalCents: 2000,
      vatRateBasisPoints: 2000,
      billingDetails: makeCustomerBillingDetails('DE'),
      createdAt: new Date(`${currentYear}-03-15T12:00:00Z`),
    })

    await createInvoice(orderFr, {
      invoiceNumber: 'INV-2026-00002',
      type: 'customer',
      subtotalCents: 900,
      vatAmountCents: 100,
      totalCents: 1000,
      vatRateBasisPoints: 2000,
      billingDetails: makeCustomerBillingDetails('FR'),
      createdAt: new Date(`${currentYear}-03-20T12:00:00Z`),
    })

    await createInvoice(orderDeReduced, {
      invoiceNumber: 'INV-2026-00003',
      type: 'customer',
      subtotalCents: 450,
      vatAmountCents: 50,
      totalCents: 500,
      vatRateBasisPoints: 1000,
      billingDetails: makeCustomerBillingDetails('DE'),
      createdAt: new Date(`${currentYear}-03-25T12:00:00Z`),
    })

    const report = await getShopTaxReportQuery('shop-1', { year: currentYear })
    expect(report.vatByCountryRate).toHaveLength(3)

    const deStandard = report.vatByCountryRate.find(
      (r) => r.buyerCountry === 'DE' && r.vatRateBasisPoints === 2000,
    )
    expect(deStandard).toEqual({
      buyerCountry: 'DE',
      vatRateBasisPoints: 2000,
      netSubtotalCents: 1800,
      vatAmountCents: 200,
      transactionCount: 1,
    })

    const deReduced = report.vatByCountryRate.find(
      (r) => r.buyerCountry === 'DE' && r.vatRateBasisPoints === 1000,
    )
    expect(deReduced).toEqual({
      buyerCountry: 'DE',
      vatRateBasisPoints: 1000,
      netSubtotalCents: 450,
      vatAmountCents: 50,
      transactionCount: 1,
    })

    const frStandard = report.vatByCountryRate.find(
      (r) => r.buyerCountry === 'FR' && r.vatRateBasisPoints === 2000,
    )
    expect(frStandard).toEqual({
      buyerCountry: 'FR',
      vatRateBasisPoints: 2000,
      netSubtotalCents: 900,
      vatAmountCents: 100,
      transactionCount: 1,
    })
  })

  it('summarises reverse-charge customer invoices', async () => {
    const platformOrder = await createPlatformOrder('buyer-user', {
      id: 'a1111111-1111-1111-1111-111111111111',
      totalCents: 10000,
      status: 'paid',
    })

    const reverseOrder = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b1111111-1111-1111-1111-111111111111',
      status: 'completed',
      subtotalCents: 2000,
      createdAt: new Date(`${currentYear}-04-15T12:00:00Z`),
    })

    const normalOrder = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b2222222-2222-2222-2222-222222222222',
      status: 'completed',
      subtotalCents: 1000,
      createdAt: new Date(`${currentYear}-04-20T12:00:00Z`),
    })

    await createInvoice(reverseOrder, {
      invoiceNumber: 'INV-2026-00001',
      type: 'customer',
      subtotalCents: 2000,
      vatAmountCents: 0,
      totalCents: 2000,
      vatRateBasisPoints: 0,
      billingDetails: makeCustomerBillingDetails('NL', true),
      createdAt: new Date(`${currentYear}-04-15T12:00:00Z`),
    })

    await createInvoice(normalOrder, {
      invoiceNumber: 'INV-2026-00002',
      type: 'customer',
      subtotalCents: 900,
      vatAmountCents: 100,
      totalCents: 1000,
      vatRateBasisPoints: 2000,
      billingDetails: makeCustomerBillingDetails('FR'),
      createdAt: new Date(`${currentYear}-04-20T12:00:00Z`),
    })

    const report = await getShopTaxReportQuery('shop-1', { year: currentYear })
    expect(report.reverseCharge).toEqual({ transactionCount: 1, netSubtotalCents: 2000 })
    expect(report.vatByCountryRate).toHaveLength(2)
  })

  it('summarises platform fee invoices', async () => {
    const platformOrder = await createPlatformOrder('buyer-user', {
      id: 'a1111111-1111-1111-1111-111111111111',
      totalCents: 10000,
      status: 'paid',
    })

    const order1 = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b1111111-1111-1111-1111-111111111111',
      status: 'completed',
      subtotalCents: 2000,
      createdAt: new Date(`${currentYear}-05-15T12:00:00Z`),
    })

    const order2 = await createShopOrder(platformOrder, 'shop-1', {
      id: 'b2222222-2222-2222-2222-222222222222',
      status: 'completed',
      subtotalCents: 1000,
      createdAt: new Date(`${currentYear}-05-20T12:00:00Z`),
    })

    await createInvoice(order1, {
      invoiceNumber: 'INV-FEE-2026-00001',
      type: 'platform_fee',
      subtotalCents: 200,
      vatAmountCents: 40,
      totalCents: 240,
      vatRateBasisPoints: 2000,
      billingDetails: makePlatformFeeBillingDetails(),
      createdAt: new Date(`${currentYear}-05-15T12:00:00Z`),
    })

    await createInvoice(order2, {
      invoiceNumber: 'INV-FEE-2026-00002',
      type: 'platform_fee',
      subtotalCents: 100,
      vatAmountCents: 0,
      totalCents: 100,
      vatRateBasisPoints: 0,
      billingDetails: makePlatformFeeBillingDetails(true),
      createdAt: new Date(`${currentYear}-05-20T12:00:00Z`),
    })

    const report = await getShopTaxReportQuery('shop-1', { year: currentYear })
    expect(report.platformFee).toEqual({
      feeSubtotalCents: 300,
      feeVatCents: 40,
      feeTotalCents: 340,
      reverseChargeCount: 1,
      reverseChargeSubtotalCents: 100,
    })
  })

  it('returns the 10 most recent invoices ordered by createdAt DESC', async () => {
    const platformOrder = await createPlatformOrder('buyer-user', {
      id: 'a1111111-1111-1111-1111-111111111111',
      totalCents: 50000,
      status: 'paid',
    })

    for (let i = 0; i < 12; i++) {
      const suffix = String(i + 1).padStart(2, '0')
      const shopOrderRecord = await createShopOrder(platformOrder, 'shop-1', {
        status: 'completed',
        subtotalCents: 1000,
        createdAt: new Date(`${currentYear}-01-${suffix}T12:00:00Z`),
      })

      await createInvoice(shopOrderRecord, {
        invoiceNumber: `INV-2026-${String(i + 1).padStart(5, '0')}`,
        type: i % 2 === 0 ? 'customer' : 'platform_fee',
        subtotalCents: 900,
        vatAmountCents: 100,
        totalCents: 1000,
        vatRateBasisPoints: 2000,
        billingDetails:
          i % 2 === 0 ? makeCustomerBillingDetails('DE') : makePlatformFeeBillingDetails(),
        createdAt: new Date(`${currentYear}-01-${suffix}T12:00:00Z`),
      })
    }

    const report = await getShopTaxReportQuery('shop-1', { year: currentYear })
    expect(report.recentInvoices).toHaveLength(10)
    expect(report.recentInvoices[0].invoiceNumber).toBe('INV-2026-00012')
    expect(report.recentInvoices[9].invoiceNumber).toBe('INV-2026-00003')

    const types = report.recentInvoices.map((i) => i.type)
    expect(types.every((t) => t === 'customer' || t === 'platform_fee')).toBe(true)
  })

  it('flags DAC7 identity as incomplete when required fields are missing', async () => {
    const incompleteCreator = await createUser({
      id: 'creator-incomplete',
      name: 'Incomplete Seller',
      email: 'incomplete@example.com',
      role: 'creator',
    })

    await createShop(incompleteCreator, {
      id: 'shop-incomplete',
      name: 'Incomplete Store',
      slug: 'incomplete-store',
      legalEntityType: 'individual',
      dateOfBirth: null,
      taxId: '1234567890',
    })

    const report = await getShopTaxReportQuery('shop-incomplete', { year: currentYear })
    expect(report.dac7IdentityComplete).toBe(false)
  })
})
