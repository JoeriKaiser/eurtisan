import { useLoaderData, useParams } from '@tanstack/react-router'
import { ShopCustomerDetailPage as ShopCustomerDetailPageComponent } from '#/components/studio/ShopCustomerDetailPage'

export function ShopCustomerDetailPage() {
  const { shopId } = useParams({ from: '/studio/$shopId/customers/$customerHash' })
  const { customer } = useLoaderData({ from: '/studio/$shopId/customers/$customerHash' })

  const stateKey = [
    customer.emailHash,
    customer.tags.join(','),
    customer.notes.map((note) => `${note.id}:${note.content}`).join(','),
  ].join(':')
  return <ShopCustomerDetailPageComponent key={stateKey} shopId={shopId} customer={customer} />
}
