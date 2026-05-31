import { describe, expect, it } from 'vitest'
import { checkoutInputSchema } from './checkout'

describe('checkoutInputSchema', () => {
  const validInput = {
    cartId: '550e8400-e29b-41d4-a716-446655440000',
    shippingSelections: [{ shopId: 'shop-1', method: 'standard' as const, costCents: 500 }],
    shippingAddress: {
      name: 'Test User',
      street: '123 Main St',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
    },
    billingAddress: {
      name: 'Test User',
      street: '123 Main St',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
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
})
