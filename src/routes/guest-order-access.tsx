import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'
import { GuestOrderAccessPage } from '#/components/GuestOrderAccessPage'
import { exchangeGuestOrderAccess } from '#/lib/checkout/guest-access'

export const Route = createFileRoute('/guest-order-access')({
  validateSearch: z.object({ token: z.string().min(32).max(256).optional() }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) => {
    if (!deps.token) return null
    const { platformOrderId } = await exchangeGuestOrderAccess({ data: { token: deps.token } })
    throw redirect({
      to: '/orders/$platformOrderId',
      params: { platformOrderId },
      replace: true,
    })
  },
  component: GuestOrderAccessPage,
  errorComponent: () => <GuestOrderAccessPage invalidLink />,
})
