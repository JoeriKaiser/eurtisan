import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { invoices, orderItem, shopOrder, platformOrder, shop, user, product } from '#/db/schema'
import {
  calculatePlatformFeeVat,
  createInvoicesForPlatformOrder,
  getInvoiceByIdQuery,
} from './invoices.server'

describe('Invoicing VAT Engine', () => {
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
})

describe('Platform Order Invoices Lifecycle', () => {
  beforeEach(async () => {
    // Clean up tables
    await db.delete(invoices)
    await db.delete(orderItem)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(product)
    await db.delete(shop)
    await db.delete(user)
  })

  it('automatically generates customer and platform fee invoices with snapshots upon successful checkout', async () => {
    // 1. Seed database
    // Seed buyer and creator users
    await db.insert(user).values([
      { id: 'buyer-1', name: 'John Doe', email: 'buyer@example.com', role: 'customer' },
      { id: 'creator-1', name: 'Alice Artisan', email: 'alice@artisan.de', role: 'creator' },
    ])

    // Seed German shop (VAT registered) with French business address
    // to verify platform fee VAT uses businessAddress, not shippingOrigin
    await db.insert(shop).values({
      id: 'shop-germany',
      name: 'Black Forest Woodworks',
      slug: 'black-forest',
      ownerId: 'creator-1',
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
    const [po] = await db
      .insert(platformOrder)
      .values({
        id: '11111111-1111-1111-1111-111111111111',
        userId: 'buyer-1',
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
      .returning()

    // Seed shop order
    const [so] = await db
      .insert(shopOrder)
      .values({
        id: '22222222-2222-2222-2222-222222222222',
        platformOrderId: po.id,
        shopId: 'shop-germany',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 5000,
        vatAmountCents: 800, // 19% standard DE VAT on base amount (~4202 cents)
        shippingVatRateBasisPoints: 1900,
        shippingVatAmountCents: 80, // ~420 cents base + ~80 cents VAT
        status: 'paid',
      })
      .returning()

    // Seed product
    await db.insert(product).values({
      id: 'prod-wooden-clock',
      name: 'Handcrafted Wooden Clock',
      slug: 'wooden-clock',
      priceCents: 5000,
      shopId: 'shop-germany',
      vatRateCategory: 'standard',
    })

    // Seed order items
    await db.insert(orderItem).values({
      id: '33333333-3333-3333-3333-333333333333',
      shopOrderId: so.id,
      productId: 'prod-wooden-clock',
      productName: 'Handcrafted Wooden Clock',
      unitPriceCents: 5000,
      quantity: 1,
      totalCents: 5000,
      vatRateBasisPoints: 1900,
      vatAmountCents: 800,
    })

    // 2. Generate Invoices
    await createInvoicesForPlatformOrder(po.id)

    // 3. Verify Customer Invoice
    const customerInvNumber = `INV-${so.id.toUpperCase()}`
    const [custInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, customerInvNumber))

    expect(custInvoice).toBeDefined()
    expect(custInvoice.type).toBe('customer')
    expect(custInvoice.totalCents).toBe(5500) // 5000 + 500
    expect(custInvoice.vatAmountCents).toBe(880) // 800 + 80
    expect(custInvoice.subtotalCents).toBe(4620) // 5500 - 880

    const custDetails = custInvoice.billingDetails as any
    expect(custDetails.from.name).toBe('Black Forest Woodworks')
    expect(custDetails.from.vatId).toBe('DE999999999')
    expect(custDetails.from.address.country).toBe('FR')
    expect(custDetails.to.name).toBe('John Doe')
    expect(custDetails.to.address.city).toBe('Berlin')
    expect(custDetails.items[0].name).toBe('Handcrafted Wooden Clock')
    expect(custDetails.shipping.costCents).toBe(500)
    expect(custDetails.reverseCharge).toBe(false)

    // 4. Verify Platform Fee Invoice
    const feeInvNumber = `INV-FEE-${so.id.toUpperCase()}`
    const [feeInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, feeInvNumber))

    expect(feeInvoice).toBeDefined()
    expect(feeInvoice.type).toBe('platform_fee')
    expect(feeInvoice.totalCents).toBe(500) // 10% of 5000 subtotal is 500 cents
    // Business address is FR (domestic B2B) so no reverse charge under franchise en base
    expect(feeInvoice.vatAmountCents).toBe(0)
    expect(feeInvoice.subtotalCents).toBe(500)

    const feeDetails = feeInvoice.billingDetails as any
    expect(feeDetails.from.name).toBe('Joeri Kaiser (Eurtisan)')
    expect(feeDetails.to.name).toBe('Black Forest Woodworks (c/o Alice Artisan)')
    expect(feeDetails.to.address.country).toBe('FR')
    expect(feeDetails.reverseCharge).toBe(false)
  })

  it('sets reverseCharge=true on customer invoice for cross-border EU B2B when buyer has VAT ID', async () => {
    await db.insert(user).values([
      { id: 'buyer-b2b', name: 'Acme GmbH', email: 'buyer-b2b@example.com', role: 'customer' },
      { id: 'creator-b2b', name: 'Pierre Artisan', email: 'pierre@artisan.fr', role: 'creator' },
    ])

    await db.insert(shop).values({
      id: 'shop-france',
      name: 'Atelier Pierre',
      slug: 'atelier-pierre',
      ownerId: 'creator-b2b',
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

    const [po] = await db
      .insert(platformOrder)
      .values({
        id: '66666666-6666-6666-6666-666666666666',
        userId: 'buyer-b2b',
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
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        id: '77777777-7777-7777-7777-777777777777',
        platformOrderId: po.id,
        shopId: 'shop-france',
        shippingMethod: 'standard',
        shippingCostCents: 200,
        subtotalCents: 1000,
        vatAmountCents: 0,
        shippingVatRateBasisPoints: 0,
        shippingVatAmountCents: 0,
        status: 'paid',
      })
      .returning()

    await db.insert(product).values({
      id: 'prod-b2b',
      name: 'B2B Product',
      slug: 'b2b-product',
      priceCents: 1000,
      shopId: 'shop-france',
      vatRateCategory: 'standard',
    })

    await db.insert(orderItem).values({
      id: '88888888-8888-8888-8888-888888888888',
      shopOrderId: so.id,
      productId: 'prod-b2b',
      productName: 'B2B Product',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    await createInvoicesForPlatformOrder(po.id)

    const customerInvNumber = `INV-${so.id.toUpperCase()}`
    const [custInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, customerInvNumber))

    expect(custInvoice).toBeDefined()
    expect(custInvoice.type).toBe('customer')

    const custDetails = custInvoice.billingDetails as any
    expect(custDetails.from.vatId).toBe('FR12345678901')
    expect(custDetails.from.address.country).toBe('FR')
    expect(custDetails.to.vatId).toBe('DE999999999')
    expect(custDetails.to.address.country).toBe('DE')
    expect(custDetails.reverseCharge).toBe(true)
  })

  it('generates invoices for multiple shop orders using batched queries', async () => {
    // Seed buyer and two creators
    await db.insert(user).values([
      { id: 'buyer-multi', name: 'Multi Buyer', email: 'multi@example.com', role: 'customer' },
      { id: 'creator-3', name: 'Carlos', email: 'carlos@artisan.es', role: 'creator' },
      { id: 'creator-4', name: 'Diana', email: 'diana@artisan.it', role: 'creator' },
    ])

    await db.insert(shop).values([
      {
        id: 'shop-spain',
        name: 'Atelier Carlos',
        slug: 'atelier-carlos',
        ownerId: 'creator-3',
        isVatRegistered: true,
        vatId: 'ES123456789',
        businessAddress: {
          street: 'Calle Mayor 1',
          city: 'Madrid',
          postalCode: '28001',
          country: 'ES',
        },
        shippingOrigin: { country: 'ES' },
      },
      {
        id: 'shop-italy',
        name: 'Studio Diana',
        slug: 'studio-diana',
        ownerId: 'creator-4',
        isVatRegistered: false,
        businessAddress: null,
        shippingOrigin: { country: 'IT' },
      },
    ])

    const [po] = await db
      .insert(platformOrder)
      .values({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        userId: 'buyer-multi',
        shippingAddress: { name: 'Multi Buyer', country: 'FR' },
        billingAddress: { name: 'Multi Buyer', country: 'FR' },
        totalCents: 3000,
        status: 'paid',
      })
      .returning()

    const [so1] = await db
      .insert(shopOrder)
      .values({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        platformOrderId: po.id,
        shopId: 'shop-spain',
        shippingMethod: 'standard',
        shippingCostCents: 200,
        subtotalCents: 1000,
        vatAmountCents: 0,
        shippingVatRateBasisPoints: 0,
        shippingVatAmountCents: 0,
        status: 'paid',
      })
      .returning()

    const [so2] = await db
      .insert(shopOrder)
      .values({
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        platformOrderId: po.id,
        shopId: 'shop-italy',
        shippingMethod: 'express',
        shippingCostCents: 300,
        subtotalCents: 1500,
        vatAmountCents: 0,
        shippingVatRateBasisPoints: 0,
        shippingVatAmountCents: 0,
        status: 'paid',
      })
      .returning()

    await db.insert(product).values([
      {
        id: 'prod-spain',
        name: 'Spanish Tile',
        slug: 'spanish-tile',
        priceCents: 1000,
        shopId: 'shop-spain',
        vatRateCategory: 'standard',
      },
      {
        id: 'prod-italy',
        name: 'Italian Leather',
        slug: 'italian-leather',
        priceCents: 1500,
        shopId: 'shop-italy',
        vatRateCategory: 'standard',
      },
    ])

    await db.insert(orderItem).values([
      {
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        shopOrderId: so1.id,
        productId: 'prod-spain',
        productName: 'Spanish Tile',
        unitPriceCents: 1000,
        quantity: 1,
        totalCents: 1000,
        vatRateBasisPoints: 0,
        vatAmountCents: 0,
      },
      {
        id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        shopOrderId: so2.id,
        productId: 'prod-italy',
        productName: 'Italian Leather',
        unitPriceCents: 1500,
        quantity: 1,
        totalCents: 1500,
        vatRateBasisPoints: 0,
        vatAmountCents: 0,
      },
    ])

    await createInvoicesForPlatformOrder(po.id)

    // Verify customer invoices for both shop orders
    const custInv1 = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, `INV-${so1.id.toUpperCase()}`))
    const custInv2 = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, `INV-${so2.id.toUpperCase()}`))

    expect(custInv1).toHaveLength(1)
    expect(custInv2).toHaveLength(1)
    expect(custInv1[0].type).toBe('customer')
    expect(custInv2[0].type).toBe('customer')

    const details1 = custInv1[0].billingDetails as any
    expect(details1.from.name).toBe('Atelier Carlos')
    expect(details1.to.name).toBe('Multi Buyer')

    const details2 = custInv2[0].billingDetails as any
    expect(details2.from.name).toBe('Studio Diana')
    expect(details2.to.name).toBe('Multi Buyer')

    // Verify platform fee invoices for both shop orders
    const feeInv1 = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, `INV-FEE-${so1.id.toUpperCase()}`))
    const feeInv2 = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, `INV-FEE-${so2.id.toUpperCase()}`))

    expect(feeInv1).toHaveLength(1)
    expect(feeInv2).toHaveLength(1)
    expect(feeInv1[0].type).toBe('platform_fee')
    expect(feeInv2[0].type).toBe('platform_fee')
  })

  it('enforces role-based authorization rules on getInvoiceByIdQuery', async () => {
    // Setup buyer, creator, and admin
    await db.insert(user).values([
      { id: 'buyer-2', name: 'John Doe', email: 'buyer@example.com', role: 'customer' },
      { id: 'creator-2', name: 'Alice Artisan', email: 'alice@artisan.de', role: 'creator' },
      { id: 'stranger', name: 'Bob', email: 'bob@example.com', role: 'customer' },
    ])

    await db.insert(shop).values({
      id: 'shop-2',
      name: 'Woodworks',
      slug: 'woodworks',
      ownerId: 'creator-2',
      shippingOrigin: { country: 'Germany' },
    })

    const [po] = await db
      .insert(platformOrder)
      .values({
        id: '44444444-4444-4444-4444-444444444444',
        userId: 'buyer-2',
        shippingAddress: { name: 'Buyer', country: 'Germany' },
        billingAddress: { name: 'Buyer', country: 'Germany' },
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        id: '55555555-5555-5555-5555-555555555555',
        platformOrderId: po.id,
        shopId: 'shop-2',
        status: 'paid',
      })
      .returning()

    await createInvoicesForPlatformOrder(po.id)

    const customerInvNumber = `INV-${so.id.toUpperCase()}`
    const feeInvNumber = `INV-FEE-${so.id.toUpperCase()}`

    // 1. Admin can access customer invoice
    const resAdminCust = await getInvoiceByIdQuery(customerInvNumber, 'admin-id', 'admin')
    expect(resAdminCust).toBeDefined()

    // 2. Admin can access platform fee invoice
    const resAdminFee = await getInvoiceByIdQuery(feeInvNumber, 'admin-id', 'admin')
    expect(resAdminFee).toBeDefined()

    // 3. Buyer can access customer invoice
    const resBuyerCust = await getInvoiceByIdQuery(customerInvNumber, 'buyer-2', 'customer')
    expect(resBuyerCust).toBeDefined()

    // 4. Buyer cannot access platform fee invoice
    await expect(getInvoiceByIdQuery(feeInvNumber, 'buyer-2', 'customer')).rejects.toThrow()

    // 5. Creator can access customer invoice
    const resCreatorCust = await getInvoiceByIdQuery(customerInvNumber, 'creator-2', 'creator')
    expect(resCreatorCust).toBeDefined()

    // 6. Creator can access platform fee invoice
    const resCreatorFee = await getInvoiceByIdQuery(feeInvNumber, 'creator-2', 'creator')
    expect(resCreatorFee).toBeDefined()

    // 7. Stranger cannot access customer invoice
    await expect(getInvoiceByIdQuery(customerInvNumber, 'stranger', 'customer')).rejects.toThrow()
  })
})
