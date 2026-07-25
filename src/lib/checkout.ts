import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
import { createUserRateLimitMiddleware } from './rate-limit'
import { isoCountryCodeSchema } from './address-validation'
import {
  checkoutAddressSchema,
  checkoutInputSchema,
  shippingSelectionSchema,
} from './checkout/schemas'
export { checkoutAddressSchema, checkoutInputSchema } from './checkout/schemas'

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

const getCheckoutServicePointsServerOnly = createServerOnlyFn(
  async (input: { postalCode: string; country: string; carrier?: string }) => {
    const { getCheckoutServicePoints } = await import('./checkout/shipping.server')
    return getCheckoutServicePoints(input.postalCode, input.country, input.carrier)
  },
)

export const getCheckoutSummary = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      cartId: z.string().uuid(),
      shippingAddress: checkoutAddressSchema.optional(),
      shippingSelections: z.array(shippingSelectionSchema).optional(),
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

    return getCheckoutServicePointsServerOnly({
      postalCode: data.postalCode,
      country: data.country,
      carrier: data.carrier,
    })
  })

export const rebuildCartFromOrder = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ platformOrderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { canAccessOrder } = await import('./checkout/guest-access.server')
    if (!(await canAccessOrder(data.platformOrderId, context.user?.id))) {
      throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { rebuildCartFromOrderQuery } = await import('./checkout.server')
    return rebuildCartFromOrderQuery(data.platformOrderId, context.user?.id ?? null)
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
    const { canAccessOrder } = await import('./checkout/guest-access.server')
    if (!(await canAccessOrder(data.platformOrderId, context.user?.id))) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Order access required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getOrderOwnerId } = await import('./orders.server')
    const ownerId = await getOrderOwnerId(data.platformOrderId)
    if (!ownerId) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { retryPayment: retryPaymentQuery } = await import('./checkout.server')
    const { molliePaymentProvider } = await import('#/integrations/mollie')
    return retryPaymentQuery(data.platformOrderId, ownerId, molliePaymentProvider)
  })
