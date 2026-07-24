import CheckoutPage from '#/components/CheckoutPage'
import { useLoaderData } from '@tanstack/react-router'

export function CheckoutRouteComponent() {
  const { summary, cartId, initialContactEmail } = useLoaderData({ from: '/checkout' })
  return (
    <CheckoutPage summary={summary} cartId={cartId} initialContactEmail={initialContactEmail} />
  )
}
