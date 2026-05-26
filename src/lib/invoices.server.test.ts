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

    // Seed German shop (VAT registered)
    await db.insert(shop).values({
      id: 'shop-germany',
      name: 'Black Forest Woodworks',
      slug: 'black-forest',
      ownerId: 'creator-1',
      isVatRegistered: true,
      vatId: 'DE999999999',
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
    expect(custDetails.from.address.country).toBe('Germany')
    expect(custDetails.to.name).toBe('John Doe')
    expect(custDetails.to.address.city).toBe('Berlin')
    expect(custDetails.items[0].name).toBe('Handcrafted Wooden Clock')
    expect(custDetails.shipping.costCents).toBe(500)

    // 4. Verify Platform Fee Invoice
    const feeInvNumber = `INV-FEE-${so.id.toUpperCase()}`
    const [feeInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, feeInvNumber))

    expect(feeInvoice).toBeDefined()
    expect(feeInvoice.type).toBe('platform_fee')
    expect(feeInvoice.totalCents).toBe(500) // 10% of 5000 subtotal is 500 cents
    // Since supplier is NL, buyer is Germany and has validated VAT ID, Reverse Charge applies
    expect(feeInvoice.vatAmountCents).toBe(0)
    expect(feeInvoice.subtotalCents).toBe(500)

    const feeDetails = feeInvoice.billingDetails as any
    expect(feeDetails.from.name).toBe('Joeri Kaiser (Eurtisan)')
    expect(feeDetails.to.name).toBe('Black Forest Woodworks (c/o Alice Artisan)')
    expect(feeDetails.reverseCharge).toBe(true)
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
