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
      country: 'Germany',
    },
    billingAddress: {
      name: 'Test User',
      street: '123 Main St',
      city: 'Berlin',
      postalCode: '10115',
      country: 'Germany',
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
        country: 'Germany',
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
        country: 'Germany',
      },
    })
    expect(result.success).toBe(true)
  })
})
