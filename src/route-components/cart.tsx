import CartPage from '#/components/CartPage'
import { useLoaderData, useSearch } from '@tanstack/react-router'

export function CartRouteComponent() {
  const { cart } = useLoaderData({ from: '/cart' })
  const { message } = useSearch({ from: '/cart' })
  return <CartPage cart={cart} showEmptyMessage={message === 'empty_cart'} />
}
