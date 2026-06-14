import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { createUserRateLimitMiddleware } from './rate-limit'
import { isoCountryCodeSchema, isPostalCodeValid } from './address-validation'
import { validateVatId } from './vat'

export type {
  CheckoutInput,
  CheckoutItem,
  CheckoutShopGroup,
  CheckoutSummary,
  CreateCheckoutResult,
  RetryPaymentResult,
  ShippingAddress,
  ShippingOption,
  ShippingSelection,
} from './checkout.server'
export type { ServicePoint } from '#/integrations/shipping'

const pickupPointSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    street: z.string().min(1),
    postalCode: z.string().min(3).max(20),
    city: z.string().min(1),
    country: isoCountryCodeSchema,
  })
  .superRefine((data, ctx) => {
    if (!isPostalCodeValid(data.postalCode, data.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid postal code format for ${data.country}`,
        path: ['postalCode'],
      })
    }
  })

const shippingAddressSchema = z
  .object({
    name: z.string().min(1).max(255),
    street: z.string().min(1).max(255),
    city: z.string().min(1).max(255),
    postalCode: z.string().min(3).max(20),
    country: isoCountryCodeSchema,
    vatId: z.string().optional().nullable(),
    pickupPoint: pickupPointSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!isPostalCodeValid(data.postalCode, data.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid postal code format for ${data.country}`,
        path: ['postalCode'],
      })
    }
    if (data.vatId) {
      const cleaned = data.vatId.replace(/\s/g, '').toUpperCase()
      const prefix = cleaned.slice(0, 2)
      if (prefix !== data.country) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `VAT ID country code prefix (${prefix}) must match address country (${data.country})`,
          path: ['vatId'],
        })
      }
      const { valid, message } = validateVatId(data.vatId)
      if (!valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: message ?? 'Invalid VAT ID format',
          path: ['vatId'],
        })
      }
    }
  })

export const checkoutInputSchema = z.object({
  cartId: z.string().uuid(),
  shippingSelections: z.array(
    z.object({
      shopId: z.string().min(1),
      rateId: z.string().optional(),
      method: z.enum(['standard', 'express', 'manual']),
      costCents: z.number().int().min(0),
    }),
  ),
  shippingAddress: shippingAddressSchema,
  billingAddress: shippingAddressSchema,
})

export const getCheckoutSummary = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      cartId: z.string().uuid(),
      shippingAddress: shippingAddressSchema.optional(),
      shippingSelections: z
        .array(
          z.object({
            shopId: z.string().min(1),
            rateId: z.string().optional(),
            method: z.enum(['standard', 'express', 'manual']),
            costCents: z.number().int().min(0),
          }),
        )
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getCheckoutSummaryQuery } = await import('./checkout.server')
    const result = await getCheckoutSummaryQuery(
      data.cartId,
      context.user.id,
      data.shippingAddress,
      data.shippingSelections,
    )

    if (!result) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Cart not found or access denied' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return result
  })

const checkoutRateLimitMiddleware = createUserRateLimitMiddleware(1, 5_000, 'checkout')

export const createCheckout = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, checkoutRateLimitMiddleware])
  .inputValidator(checkoutInputSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { createCheckoutQuery } = await import('./checkout.server')
    return createCheckoutQuery(data, context.user.id)
  })

const getServicePointsRateLimitMiddleware = createUserRateLimitMiddleware(
  10,
  60_000,
  'service_points',
)

export const getServicePoints = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, getServicePointsRateLimitMiddleware])
  .inputValidator(
    z.object({
      postalCode: z.string().min(3).max(20),
      country: isoCountryCodeSchema,
      carrier: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getShippingProvider } = await import('#/integrations/shipping')
    const provider = getShippingProvider()
    return provider.getServicePoints(data.postalCode, data.country, data.carrier)
  })

const retryPaymentRateLimitMiddleware = createUserRateLimitMiddleware(3, 60_000, 'retry_payment')

export const retryPayment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, retryPaymentRateLimitMiddleware])
  .inputValidator(
    z.object({
      platformOrderId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { retryPayment: retryPaymentQuery } = await import('./checkout.server')
    const { molliePaymentProvider } = await import('#/integrations/mollie')
    return retryPaymentQuery(data.platformOrderId, context.user.id, molliePaymentProvider)
  })
