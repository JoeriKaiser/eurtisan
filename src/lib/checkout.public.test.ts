import { describe, expect, it } from 'vitest'
import { checkoutInputSchema } from './checkout'

describe('checkoutInputSchema', () => {
  const validInput = {
    cartId: '550e8400-e29b-41d4-a716-446655440000',
    checkoutAttemptId: '650e8400-e29b-41d4-a716-446655440000',
    contactEmail: 'buyer@example.com',
    shippingSelections: [{ shopId: 'shop-1', method: 'standard' as const, costCents: 500 }],
    shippingAddress: {
      name: 'Test User',
      street: '123 Main St',
      addressLine2: '',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
      contactEmail: 'buyer@example.com',
      phone: '',
    },
    billingAddress: {
      name: 'Test User',
      street: '123 Main St',
      addressLine2: '',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
      contactEmail: 'buyer@example.com',
      phone: '',
    },
  }

  it('accepts valid checkout input with billing address', () => {
    const result = checkoutInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects missing billing address', () => {
    const { billingAddress: _, ...withoutBilling } = validInput
    const result = checkoutInputSchema.safeParse(withoutBilling)
    expect(result.success).toBe(false)
  })

  it('rejects invalid billing address fields', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        name: '',
        street: '123 Main St',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      },
    })
    expect(result.success).toBe(false)
  })

  it('accepts distinct shipping and billing addresses', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        name: 'Billing User',
        street: '456 Oak Ave',
        city: 'Munich',
        postalCode: '80331',
        country: 'DE',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid country code', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      shippingAddress: {
        ...validInput.shippingAddress,
        country: 'Germany',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid postal code for DE', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      shippingAddress: {
        ...validInput.shippingAddress,
        postalCode: 'ABCDE',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects too-short postal code', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      shippingAddress: {
        ...validInput.shippingAddress,
        postalCode: '12',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects postal code with special characters', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      shippingAddress: {
        ...validInput.shippingAddress,
        country: 'XK',
        postalCode: '12!',
      },
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid VAT ID matching country code', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        vatId: 'DE123456789',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects VAT ID with prefix mismatching country code', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        vatId: 'FR12345678901',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid format VAT ID', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        vatId: 'DE123',
      },
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid Belgian VAT ID', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        country: 'BE',
        postalCode: '1000',
        vatId: 'BE0123456789',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a Belgian VAT ID that does not start with 0 or 1', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        country: 'BE',
        postalCode: '1000',
        vatId: 'BE2123456789',
      },
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid Irish VAT ID', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        country: 'IE',
        postalCode: 'D01 F5P2',
        vatId: 'IE1234567A',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an Irish VAT ID ending in X', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        country: 'IE',
        postalCode: 'D01 F5P2',
        vatId: 'IE1234567X',
      },
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid Swedish VAT ID', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        country: 'SE',
        postalCode: '111 22',
        vatId: 'SE123456789012',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a Swedish VAT ID that is too short', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        country: 'SE',
        postalCode: '111 22',
        vatId: 'SE1234567890',
      },
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid Spanish VAT ID', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        country: 'ES',
        postalCode: '08001',
        vatId: 'ESA1234567B',
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a Greek EL VAT ID for a GR address', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        country: 'GR',
        vatId: 'EL123456789',
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a Greek GR VAT ID for a GR address', () => {
    const result = checkoutInputSchema.safeParse({
      ...validInput,
      billingAddress: {
        ...validInput.billingAddress,
        country: 'GR',
        vatId: 'GR123456789',
      },
    })
    expect(result.success).toBe(true)
  })
})
