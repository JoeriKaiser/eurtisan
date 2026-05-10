import { createFileRoute } from '@tanstack/react-router'
import CartPage from '#/components/CartPage'
import { getCart } from '#/lib/cart'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/cart')({
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
  return <CartPage cart={cart} />
}
