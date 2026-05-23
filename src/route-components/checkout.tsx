import CheckoutPage from '#/components/CheckoutPage'
import { useLoaderData } from '@tanstack/react-router'

export function CheckoutRouteComponent() {
  const { summary, cartId } = useLoaderData({ from: '/checkout' })
  return <CheckoutPage summary={summary} cartId={cartId} />
}
