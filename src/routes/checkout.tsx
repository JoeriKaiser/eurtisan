import { createFileRoute, redirect } from '@tanstack/react-router'
import { CheckoutRouteComponent } from '#/route-components/checkout'
import { getCart } from '#/lib/cart'
import { getCheckoutSummary } from '#/lib/checkout'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/checkout')({
  beforeLoad: async () => guardAuth('/checkout'),
  loader: async () => {
    const cart = await getCart()
    if (!cart || cart.totalItems === 0) {
      throw redirect({ to: '/cart', search: { message: 'empty_cart' } })
    }
    const summary = await getCheckoutSummary({ data: { cartId: cart.id } })
    if (!summary || summary.shops.length === 0) {
      throw redirect({ to: '/cart', search: { message: 'empty_cart' } })
    }
    return { summary, cartId: cart.id }
  },
  head: () => ({
    meta: [
      { title: `${m.checkout_title()} | Eurtisan` },
      { name: 'description', content: m.checkout_title() },
    ],
  }),
  component: CheckoutRouteComponent,
})
