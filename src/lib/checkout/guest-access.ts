import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { createIpRateLimitMiddleware } from '../rate-limit'

export const requestGuestOrderAccess = createServerFn({ method: 'POST' })
  .middleware([createIpRateLimitMiddleware(3, 15 * 60_000, 'guest-order-access')])
  .inputValidator(
    z.object({
      orderNumber: z.string().trim().min(3).max(100),
      email: z.string().trim().email().max(320),
    }),
  )
  .handler(async ({ data }) => {
    const { requestGuestOrderAccessEmail } = await import('./guest-access.server')
    await requestGuestOrderAccessEmail(data)
    return { sent: true }
  })

export const exchangeGuestOrderAccess = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ token: z.string().min(32).max(256) }))
  .handler(async ({ data }) => {
    const { exchangeGuestOrderAccessToken } = await import('./guest-access.server')
    return { platformOrderId: await exchangeGuestOrderAccessToken(data.token) }
  })
