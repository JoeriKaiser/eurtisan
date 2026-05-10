import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import CartPage from '#/components/CartPage'
import { getCart } from '#/lib/cart'
import { m } from '#/paraglide/messages'

const cartSearchSchema = z.object({
  message: z.string().optional(),
})

export const Route = createFileRoute('/cart')({
  validateSearch: cartSearchSchema,
  loader: async () => {
    const cart = await getCart()
    return { cart }
  },
  head: () => ({
    meta: [
      { title: `${m.cart_title()} | Eurtisan` },
      { name: 'description', content: m.cart_title() },
    ],
  }),
  component: CartRouteComponent,
})

function CartRouteComponent() {
  const { cart } = Route.useLoaderData()
  const { message } = Route.useSearch()
  return <CartPage cart={cart} showEmptyMessage={message === 'empty_cart'} />
}
