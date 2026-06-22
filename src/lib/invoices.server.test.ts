import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { invoices } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import {
  createOrderItem,
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import {
  type BillingDetails,
  calculatePlatformFeeVat,
  createCreditNoteForShopOrder,
  createInvoicesForPlatformOrder,
  getInvoiceByIdQuery,
} from './invoices.server'
import { PLATFORM_FEE_PERCENT } from './platform-constants'

describe('Invoicing VAT Engine', () => {
  const originalVatLiable = process.env.PLATFORM_VAT_LIABLE

  beforeEach(() => {
    process.env.PLATFORM_VAT_LIABLE = 'false'
  })

  afterEach(() => {
    process.env.PLATFORM_VAT_LIABLE = originalVatLiable
  })

  it('does not charge VAT (0%) for domestic platform fee (supplier FR, customer FR)', () => {
    const result = calculatePlatformFeeVat('FR', true, 1200) // 12.00 EUR total fee
    expect(result).toEqual({
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
      subtotalCents: 1200,
      totalCents: 1200,
      reverseCharge: false,
    })
  })

  it('does not charge VAT (0%) for domestic platform fee even if not registered (supplier FR, customer FR)', () => {
    const result = calculatePlatformFeeVat('FR', false, 1200)
    expect(result).toEqual({
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
      subtotalCents: 1200,
      totalCents: 1200,
      reverseCharge: false,
    })
  })

  it('applies reverse charge (0% VAT) for cross-border EU B2B (supplier FR, customer DE with VAT ID)', () => {
    const result = calculatePlatformFeeVat('DE', true, 1000)
    expect(result).toEqual({
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
      subtotalCents: 1000,
      totalCents: 1000,
      reverseCharge: true,
    })
  })

  it('does not charge VAT (0%) for cross-border EU B2C (supplier FR, customer DE without VAT ID)', () => {
    const result = calculatePlatformFeeVat('DE', false, 1200)
    expect(result).toEqual({
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
      subtotalCents: 1200,
      totalCents: 1200,
      reverseCharge: false,
    })
  })

  it('exempts VAT (0%) for exports outside the EU (supplier FR, customer US)', () => {
    const result = calculatePlatformFeeVat('US', false, 1000)
    expect(result).toEqual({
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
      subtotalCents: 1000,
      totalCents: 1000,
      reverseCharge: false,
    })
  })

  it('throws an error on unrecognized or unmappable country names if they are not empty', () => {
    expect(() => calculatePlatformFeeVat('Deutschland', false, 1200)).toThrowError(
      'Unrecognized country code or name: "Deutschland"',
    )
    expect(() => calculatePlatformFeeVat('RandomState', false, 1200)).toThrowError(
      'Unrecognized country code or name: "RandomState"',
    )
  })

  it('does not throw an error and returns 0% VAT if country name is empty or only whitespace', () => {
    const resultEmpty = calculatePlatformFeeVat('', false, 1200)
    expect(resultEmpty).toEqual({
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
      subtotalCents: 1200,
      totalCents: 1200,
      reverseCharge: false,
    })

    const resultSpaces = calculatePlatformFeeVat('   ', false, 1200)
    expect(resultSpaces).toEqual({
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
      subtotalCents: 1200,
      totalCents: 1200,
      reverseCharge: false,
    })
  })

  describe('when PLATFORM_VAT_LIABLE is true', () => {
    const originalVatLiable = process.env.PLATFORM_VAT_LIABLE

    beforeEach(() => {
      process.env.PLATFORM_VAT_LIABLE = 'true'
    })

    afterEach(() => {
      process.env.PLATFORM_VAT_LIABLE = originalVatLiable
    })

    it('charges standard French VAT (20%) for domestic platform fee (supplier FR, customer FR)', () => {
      const result = calculatePlatformFeeVat('FR', false, 1200) // 12.00 EUR total fee (inclusive of 20% VAT)
      expect(result).toEqual({
        vatRateBasisPoints: 2000,
        vatAmountCents: 200,
        subtotalCents: 1000,
        totalCents: 1200,
        reverseCharge: false,
      })
    })

    it('applies reverse charge (0% VAT) for cross-border EU B2B (supplier FR, customer DE with VAT ID)', () => {
      const result = calculatePlatformFeeVat('DE', true, 1000)
      expect(result).toEqual({
        vatRateBasisPoints: 0,
        vatAmountCents: 0,
        subtotalCents: 1000,
        totalCents: 1000,
        reverseCharge: true,
      })
    })

    it('charges destination country standard rate (e.g. 21% for NL) for EU B2C (supplier FR, customer NL)', () => {
      const result = calculatePlatformFeeVat('NL', false, 1210) // 12.10 EUR total fee (inclusive of 21% VAT)
      expect(result).toEqual({
        vatRateBasisPoints: 2100,
        vatAmountCents: 210,
        subtotalCents: 1000,
        totalCents: 1210,
        reverseCharge: false,
      })
    })

    it('exempts VAT (0%) for exports outside the EU (supplier FR, customer US)', () => {
      const result = calculatePlatformFeeVat('US', false, 1000)
      expect(result).toEqual({
        vatRateBasisPoints: 0,
        vatAmountCents: 0,
        subtotalCents: 1000,
        totalCents: 1000,
        reverseCharge: false,
      })
    })
  })
})

describe('Platform Order Invoices Lifecycle', () => {
  const originalVatLiable = process.env.PLATFORM_VAT_LIABLE

  beforeEach(async () => {
    process.env.PLATFORM_VAT_LIABLE = 'false'
    await clearTestTables()
  })

  afterEach(() => {
    process.env.PLATFORM_VAT_LIABLE = originalVatLiable
  })

  it('automatically generates customer and platform fee invoices with snapshots upon successful checkout', async () => {
    // 1. Seed database
    await createUser({
      id: 'buyer-1',
      name: 'John Doe',
      email: 'buyer@example.com',
      role: 'customer',
    })
    await createUser({
      id: 'creator-1',
      name: 'Alice Artisan',
      email: 'alice@artisan.de',
      role: 'creator',
    })

    // Seed German shop (VAT registered) with French business address
    // to verify platform fee VAT uses businessAddress, not shippingOrigin
    const shopRecord = await createShop('creator-1', {
      id: 'shop-germany',
      name: 'Black Forest Woodworks',
      slug: 'black-forest',
      isVatRegistered: true,
      vatId: 'DE999999999',
      businessAddress: {
        street: '5 Chemin de Gramont',
        city: 'Toulouse',
        postalCode: '31200',
        country: 'FR',
      },
      shippingOrigin: {
        street: 'Waldstraße 5',
        city: 'Freiburg',
        postalCode: '79098',
        country: 'Germany',
      },
    })

    // Seed platform order
    const po = await createPlatformOrder('buyer-1', {
      id: '11111111-1111-1111-1111-111111111111',
      shippingAddress: {
        name: 'John Doe',
        street: 'Leipziger Str. 12',
        city: 'Berlin',
        postalCode: '10117',
        country: 'Germany',
      },
      billingAddress: {
        name: 'John Doe',
        street: 'Leipziger Str. 12',
        city: 'Berlin',
        postalCode: '10117',
        country: 'Germany',
      },
      totalCents: 5500, // 50.00 subtotal + 5.00 shipping
      status: 'paid',
    })

    // Seed shop order
    const so = await createShopOrder(po, shopRecord, {
      id: '22222222-2222-2222-2222-222222222222',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 5000,
      vatAmountCents: 800, // 19% standard DE VAT on base amount (~4202 cents)
      shippingVatRateBasisPoints: 1900,
      shippingVatAmountCents: 80, // ~420 cents base + ~80 cents VAT
      status: 'paid',
    })

    // Seed product
    const product = await createProduct(shopRecord, {
      id: 'prod-wooden-clock',
      name: 'Handcrafted Wooden Clock',
      slug: 'wooden-clock',
      priceCents: 5000,
      vatRateCategory: 'standard',
    })

    // Seed order items
    await createOrderItem(so, product, {
      id: '33333333-3333-3333-3333-333333333333',
      productName: 'Handcrafted Wooden Clock',
      unitPriceCents: 5000,
      quantity: 1,
      totalCents: 5000,
      vatRateBasisPoints: 1900,
      vatAmountCents: 800,
    })

    // 2. Generate Invoices
    const created = await createInvoicesForPlatformOrder(po.id)
    const invoiceNumbers = created.get(so.id)
    expect(invoiceNumbers).toBeDefined()
    if (!invoiceNumbers) throw new Error('Expected invoice numbers for shop order')
    const { customerInvoiceNumber, platformFeeInvoiceNumber } = invoiceNumbers

    // 3. Verify Customer Invoice
    const [custInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, customerInvoiceNumber))

    expect(custInvoice).toBeDefined()
    expect(custInvoice.type).toBe('customer')
    expect(custInvoice.totalCents).toBe(5500) // 5000 + 500
    expect(custInvoice.vatAmountCents).toBe(880) // 800 + 80
    expect(custInvoice.subtotalCents).toBe(4620) // 5500 - 880

    const custDetails = custInvoice.billingDetails as BillingDetails
    expect(custDetails.from.name).toBe('Black Forest Woodworks')
    expect(custDetails.from.vatId).toBe('DE999999999')
    expect(custDetails.from.address.country).toBe('FR')
    expect(custDetails.to.name).toBe('John Doe')
    expect(custDetails.to.address.city).toBe('Berlin')
    expect(custDetails.items[0].name).toBe('Handcrafted Wooden Clock')
    expect(custDetails.shipping).toBeDefined()
    expect(custDetails.shipping?.costCents).toBe(500)
    expect(custDetails.reverseCharge).toBe(false)

    // 4. Verify Platform Fee Invoice
    const [feeInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, platformFeeInvoiceNumber))

    expect(feeInvoice).toBeDefined()
    expect(feeInvoice.type).toBe('platform_fee')
    const expectedFee = Math.round((5000 - 800) * (PLATFORM_FEE_PERCENT / 100))
    expect(feeInvoice.totalCents).toBe(expectedFee)
    // Business address is FR (domestic B2B) so no reverse charge under franchise en base
    expect(feeInvoice.vatAmountCents).toBe(0)
    expect(feeInvoice.subtotalCents).toBe(expectedFee)

    const feeDetails = feeInvoice.billingDetails as BillingDetails
    expect(feeDetails.from.name).toBe('Joeri Kaiser (Eurtisan)')
    expect(feeDetails.to.name).toBe('Black Forest Woodworks (c/o Alice Artisan)')
    expect(feeDetails.to.address.country).toBe('FR')
    expect(feeDetails.reverseCharge).toBe(false)
  })

  it('sets reverseCharge=true on customer invoice for cross-border EU B2B when buyer has VAT ID', async () => {
    await createUser({
      id: 'buyer-b2b',
      name: 'Acme GmbH',
      email: 'buyer-b2b@example.com',
      role: 'customer',
    })
    await createUser({
      id: 'creator-b2b',
      name: 'Pierre Artisan',
      email: 'pierre@artisan.fr',
      role: 'creator',
    })

    const shopRecord = await createShop('creator-b2b', {
      id: 'shop-france',
      name: 'Atelier Pierre',
      slug: 'atelier-pierre',
      isVatRegistered: true,
      vatId: 'FR12345678901',
      businessAddress: {
        street: '12 Rue de la Paix',
        city: 'Paris',
        postalCode: '75002',
        country: 'FR',
      },
      shippingOrigin: {
        street: '12 Rue de la Paix',
        city: 'Paris',
        postalCode: '75002',
        country: 'FR',
      },
    })

    const po = await createPlatformOrder('buyer-b2b', {
      id: '66666666-6666-6666-6666-666666666666',
      shippingAddress: {
        name: 'Acme GmbH',
        street: 'Hauptstraße 1',
        city: 'Berlin',
        postalCode: '10117',
        country: 'DE',
      },
      billingAddress: {
        name: 'Acme GmbH',
        street: 'Hauptstraße 1',
        city: 'Berlin',
        postalCode: '10117',
        country: 'DE',
        vatId: 'DE999999999',
      },
      totalCents: 1200,
      status: 'paid',
    })

    const so = await createShopOrder(po, shopRecord, {
      id: '77777777-7777-7777-7777-777777777777',
      shippingMethod: 'standard',
      shippingCostCents: 200,
      subtotalCents: 1000,
      vatAmountCents: 0,
      shippingVatRateBasisPoints: 0,
      shippingVatAmountCents: 0,
      status: 'paid',
    })

    const product = await createProduct(shopRecord, {
      id: 'prod-b2b',
      name: 'B2B Product',
      slug: 'b2b-product',
      priceCents: 1000,
      vatRateCategory: 'standard',
    })

    await createOrderItem(so, product, {
      id: '88888888-8888-8888-8888-888888888888',
      productName: 'B2B Product',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    const created = await createInvoicesForPlatformOrder(po.id)
    const invoiceNumbers = created.get(so.id)
    expect(invoiceNumbers).toBeDefined()
    if (!invoiceNumbers) throw new Error('Expected invoice numbers for shop order')
    const { customerInvoiceNumber } = invoiceNumbers

    const [custInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, customerInvoiceNumber))

    expect(custInvoice).toBeDefined()
    expect(custInvoice.type).toBe('customer')
    expect(custInvoice.vatAmountCents).toBe(0)
    expect(custInvoice.subtotalCents).toBe(1200)
    expect(custInvoice.totalCents).toBe(1200)

    const custDetails = custInvoice.billingDetails as BillingDetails
    expect(custDetails.from.vatId).toBe('FR12345678901')
    expect(custDetails.from.address.country).toBe('FR')
    expect(custDetails.to.vatId).toBe('DE999999999')
    expect(custDetails.to.address.country).toBe('DE')
    expect(custDetails.reverseCharge).toBe(true)
  })

  it('correctly sets vatAmountCents to 0 and subtotalCents to totalGross in DB even if shopOrder had non-zero VAT when reverse charge applies', async () => {
    await createUser({
      id: 'buyer-b2b-err',
      name: 'Acme GmbH 2',
      email: 'buyer-b2b-err@example.com',
      role: 'customer',
    })
    await createUser({
      id: 'creator-b2b-err',
      name: 'Pierre Artisan 2',
      email: 'pierre-err@artisan.fr',
      role: 'creator',
    })

    const shopRecord = await createShop('creator-b2b-err', {
      id: 'shop-france-err',
      name: 'Atelier Pierre 2',
      slug: 'atelier-pierre-2',
      isVatRegistered: true,
      vatId: 'FR12345678901',
      businessAddress: {
        street: '12 Rue de la Paix',
        city: 'Paris',
        postalCode: '75002',
        country: 'FR',
      },
      shippingOrigin: {
        street: '12 Rue de la Paix',
        city: 'Paris',
        postalCode: '75002',
        country: 'FR',
      },
    })

    const po = await createPlatformOrder('buyer-b2b-err', {
      id: '99999999-9999-9999-9999-999999999999',
      shippingAddress: {
        name: 'Acme GmbH 2',
        street: 'Hauptstraße 1',
        city: 'Berlin',
        postalCode: '10117',
        country: 'DE',
      },
      billingAddress: {
        name: 'Acme GmbH 2',
        street: 'Hauptstraße 1',
        city: 'Berlin',
        postalCode: '10117',
        country: 'DE',
        vatId: 'DE999999999',
      },
      totalCents: 1200,
      status: 'paid',
    })

    const so = await createShopOrder(po, shopRecord, {
      id: '88888888-8888-8888-8888-888888888888',
      shippingMethod: 'standard',
      shippingCostCents: 200,
      subtotalCents: 1000,
      vatAmountCents: 190,
      shippingVatRateBasisPoints: 1900,
      shippingVatAmountCents: 10,
      status: 'paid',
    })

    const product = await createProduct(shopRecord, {
      id: 'prod-b2b-err',
      name: 'B2B Product 2',
      slug: 'b2b-product-2',
      priceCents: 1000,
      vatRateCategory: 'standard',
    })

    await createOrderItem(so, product, {
      id: '99999999-8888-7777-6666-555555555555',
      productName: 'B2B Product 2',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      vatRateBasisPoints: 1900,
      vatAmountCents: 190,
    })

    const created = await createInvoicesForPlatformOrder(po.id)
    const invoiceNumbers = created.get(so.id)
    expect(invoiceNumbers).toBeDefined()
    if (!invoiceNumbers) throw new Error('Expected invoice numbers for shop order')
    const { customerInvoiceNumber } = invoiceNumbers

    const [custInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, customerInvoiceNumber))

    expect(custInvoice).toBeDefined()
    expect(custInvoice.vatAmountCents).toBe(0)
    expect(custInvoice.subtotalCents).toBe(1200)
    expect(custInvoice.totalCents).toBe(1200)

    const custDetails = custInvoice.billingDetails as BillingDetails
    expect(custDetails.reverseCharge).toBe(true)
    expect(custDetails.items[0].vatAmountCents).toBe(0)
    expect(custDetails.shipping).toBeDefined()
    expect(custDetails.shipping?.vatAmountCents).toBe(0)
  })

  it('generates invoices for multiple shop orders using batched queries', async () => {
    // Seed buyer and two creators
    await createUser({
      id: 'buyer-multi',
      name: 'Multi Buyer',
      email: 'multi@example.com',
      role: 'customer',
    })
    await createUser({
      id: 'creator-3',
      name: 'Carlos',
      email: 'carlos@artisan.es',
      role: 'creator',
    })
    await createUser({
      id: 'creator-4',
      name: 'Diana',
      email: 'diana@artisan.it',
      role: 'creator',
    })

    const shopSpain = await createShop('creator-3', {
      id: 'shop-spain',
      name: 'Atelier Carlos',
      slug: 'atelier-carlos',
      isVatRegistered: true,
      vatId: 'ES123456789',
      businessAddress: {
        street: 'Calle Mayor 1',
        city: 'Madrid',
        postalCode: '28001',
        country: 'ES',
      },
      shippingOrigin: { country: 'ES' },
    })

    const shopItaly = await createShop('creator-4', {
      id: 'shop-italy',
      name: 'Studio Diana',
      slug: 'studio-diana',
      isVatRegistered: false,
      businessAddress: null,
      shippingOrigin: { country: 'IT' },
    })

    const po = await createPlatformOrder('buyer-multi', {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      shippingAddress: { name: 'Multi Buyer', country: 'FR' },
      billingAddress: { name: 'Multi Buyer', country: 'FR' },
      totalCents: 3000,
      status: 'paid',
    })

    const so1 = await createShopOrder(po, shopSpain, {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      shippingMethod: 'standard',
      shippingCostCents: 200,
      subtotalCents: 1000,
      vatAmountCents: 0,
      shippingVatRateBasisPoints: 0,
      shippingVatAmountCents: 0,
      status: 'paid',
    })

    const so2 = await createShopOrder(po, shopItaly, {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      shippingMethod: 'express',
      shippingCostCents: 300,
      subtotalCents: 1500,
      vatAmountCents: 0,
      shippingVatRateBasisPoints: 0,
      shippingVatAmountCents: 0,
      status: 'paid',
    })

    const prodSpain = await createProduct(shopSpain, {
      id: 'prod-spain',
      name: 'Spanish Tile',
      slug: 'spanish-tile',
      priceCents: 1000,
      vatRateCategory: 'standard',
    })

    const prodItaly = await createProduct(shopItaly, {
      id: 'prod-italy',
      name: 'Italian Leather',
      slug: 'italian-leather',
      priceCents: 1500,
      vatRateCategory: 'standard',
    })

    await createOrderItem(so1, prodSpain, {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      productName: 'Spanish Tile',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    await createOrderItem(so2, prodItaly, {
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      productName: 'Italian Leather',
      unitPriceCents: 1500,
      quantity: 1,
      totalCents: 1500,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    const created = await createInvoicesForPlatformOrder(po.id)
    const so1Numbers = created.get(so1.id)
    expect(so1Numbers).toBeDefined()
    if (!so1Numbers) throw new Error('Expected invoice numbers for first shop order')
    const so2Numbers = created.get(so2.id)
    expect(so2Numbers).toBeDefined()
    if (!so2Numbers) throw new Error('Expected invoice numbers for second shop order')

    // Verify customer invoices for both shop orders
    const custInv1 = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, so1Numbers.customerInvoiceNumber))
    const custInv2 = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, so2Numbers.customerInvoiceNumber))

    expect(custInv1).toHaveLength(1)
    expect(custInv2).toHaveLength(1)
    expect(custInv1[0].type).toBe('customer')
    expect(custInv2[0].type).toBe('customer')

    const details1 = custInv1[0].billingDetails as BillingDetails
    expect(details1.from.name).toBe('Atelier Carlos')
    expect(details1.to.name).toBe('Multi Buyer')

    const details2 = custInv2[0].billingDetails as BillingDetails
    expect(details2.from.name).toBe('Studio Diana')
    expect(details2.to.name).toBe('Multi Buyer')

    // Verify platform fee invoices for both shop orders
    const feeInv1 = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, so1Numbers.platformFeeInvoiceNumber))
    const feeInv2 = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, so2Numbers.platformFeeInvoiceNumber))

    expect(feeInv1).toHaveLength(1)
    expect(feeInv2).toHaveLength(1)
    expect(feeInv1[0].type).toBe('platform_fee')
    expect(feeInv2[0].type).toBe('platform_fee')

    // Customer invoice numbers within the same platform order must be strictly sequential.
    const match = /^INV-\d{4}-(\d{5})$/
    const m1 = so1Numbers.customerInvoiceNumber.match(match)
    const m2 = so2Numbers.customerInvoiceNumber.match(match)
    expect(m1).not.toBeNull()
    expect(m2).not.toBeNull()
    expect(Number(m2?.[1])).toBe(Number(m1?.[1]) + 1)

    // Platform-fee invoice numbers are also sequential within their own prefix.
    const f1 = so1Numbers.platformFeeInvoiceNumber.match(/^INV-FEE-\d{4}-(\d{5})$/)
    const f2 = so2Numbers.platformFeeInvoiceNumber.match(/^INV-FEE-\d{4}-(\d{5})$/)
    expect(f1).not.toBeNull()
    expect(f2).not.toBeNull()
    expect(Number(f2?.[1])).toBe(Number(f1?.[1]) + 1)
  })

  it('enforces role-based authorization rules on getInvoiceByIdQuery', async () => {
    // Setup buyer, creator, and admin
    await createUser({
      id: 'buyer-2',
      name: 'John Doe',
      email: 'buyer@example.com',
      role: 'customer',
    })
    await createUser({
      id: 'creator-2',
      name: 'Alice Artisan',
      email: 'alice@artisan.de',
      role: 'creator',
    })
    await createUser({
      id: 'stranger',
      name: 'Bob',
      email: 'bob@example.com',
      role: 'customer',
    })

    const shopRecord = await createShop('creator-2', {
      id: 'shop-2',
      name: 'Woodworks',
      slug: 'woodworks',
      shippingOrigin: { country: 'Germany' },
    })

    const po = await createPlatformOrder('buyer-2', {
      id: '44444444-4444-4444-4444-444444444444',
      shippingAddress: { name: 'Buyer', country: 'Germany' },
      billingAddress: { name: 'Buyer', country: 'Germany' },
      totalCents: 0,
      status: 'paid',
    })

    const so = await createShopOrder(po, shopRecord, {
      id: '55555555-5555-5555-5555-555555555555',
      status: 'paid',
    })

    const created = await createInvoicesForPlatformOrder(po.id)
    const invoiceNumbers = created.get(so.id)
    expect(invoiceNumbers).toBeDefined()
    if (!invoiceNumbers) throw new Error('Expected invoice numbers for shop order')
    const { customerInvoiceNumber, platformFeeInvoiceNumber } = invoiceNumbers

    // 1. Admin can access customer invoice
    const resAdminCust = await getInvoiceByIdQuery(customerInvoiceNumber, 'admin-id', 'admin')
    expect(resAdminCust).toBeDefined()

    // 2. Admin can access platform fee invoice
    const resAdminFee = await getInvoiceByIdQuery(platformFeeInvoiceNumber, 'admin-id', 'admin')
    expect(resAdminFee).toBeDefined()

    // 3. Buyer can access customer invoice
    const resBuyerCust = await getInvoiceByIdQuery(customerInvoiceNumber, 'buyer-2', 'customer')
    expect(resBuyerCust).toBeDefined()

    // 4. Buyer cannot access platform fee invoice
    await expect(
      getInvoiceByIdQuery(platformFeeInvoiceNumber, 'buyer-2', 'customer'),
    ).rejects.toThrow()

    // 5. Creator can access customer invoice
    const resCreatorCust = await getInvoiceByIdQuery(customerInvoiceNumber, 'creator-2', 'creator')
    expect(resCreatorCust).toBeDefined()

    // 6. Creator can access platform fee invoice
    const resCreatorFee = await getInvoiceByIdQuery(
      platformFeeInvoiceNumber,
      'creator-2',
      'creator',
    )
    expect(resCreatorFee).toBeDefined()

    // 7. Stranger cannot access customer invoice
    await expect(
      getInvoiceByIdQuery(customerInvoiceNumber, 'stranger', 'customer'),
    ).rejects.toThrow()
  })
})

describe('Sequential invoice numbering', () => {
  const originalVatLiable = process.env.PLATFORM_VAT_LIABLE

  beforeEach(async () => {
    process.env.PLATFORM_VAT_LIABLE = 'false'
    await clearTestTables()
  })

  afterEach(() => {
    process.env.PLATFORM_VAT_LIABLE = originalVatLiable
  })

  async function seedNumberingFixture() {
    const buyer = await createUser({ name: 'Buyer', role: 'customer' })
    const owner = await createUser({ name: 'Owner', role: 'creator' })
    const shopRecord = await createShop(owner, { name: 'Number Shop' })
    const prod = await createProduct(shopRecord, { name: 'Item' })
    const po = await createPlatformOrder(buyer, {
      shippingAddress: { name: 'Buyer', country: 'FR' },
      billingAddress: { name: 'Buyer', country: 'FR' },
      totalCents: 1200,
      status: 'paid',
    })
    const so = await createShopOrder(po, shopRecord, {
      shippingMethod: 'standard',
      shippingCostCents: 200,
      subtotalCents: 1000,
      vatAmountCents: 0,
      shippingVatRateBasisPoints: 0,
      shippingVatAmountCents: 0,
      status: 'paid',
    })
    await createOrderItem(so, prod, {
      productName: 'Item',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })
    return { shopOrder: so }
  }

  it('allocates sequential customer and platform fee invoice numbers', async () => {
    const { shopOrder: so1 } = await seedNumberingFixture()
    const { shopOrder: so2 } = await seedNumberingFixture()

    const created1 = await createInvoicesForPlatformOrder(so1.platformOrderId)
    const created2 = await createInvoicesForPlatformOrder(so2.platformOrderId)

    const n1 = created1.get(so1.id)
    const n2 = created2.get(so2.id)
    expect(n1).toBeDefined()
    expect(n2).toBeDefined()

    const match = /^INV-\d{4}-(\d{5})$/
    const m1 = n1?.customerInvoiceNumber.match(match)
    const m2 = n2?.customerInvoiceNumber.match(match)
    expect(m1).not.toBeNull()
    expect(m2).not.toBeNull()
    expect(Number(m2?.[1])).toBe(Number(m1?.[1]) + 1)
  })

  it('creates a credit note linked to the original customer invoice', async () => {
    const { shopOrder: so } = await seedNumberingFixture()
    await createInvoicesForPlatformOrder(so.platformOrderId)

    const creditNoteNumber = await createCreditNoteForShopOrder(so.id)
    expect(creditNoteNumber).toMatch(/^CN-\d{4}-\d{5}$/)
    expect(creditNoteNumber).toBeDefined()
    if (!creditNoteNumber) throw new Error('Expected credit note number')

    const [note] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, creditNoteNumber))
    expect(note).toBeDefined()
    expect(note.type).toBe('credit_note')
    expect(note.originalInvoiceNumber).toBeDefined()
    expect(note.totalCents).toBeLessThan(0)
  })
})
