import { useLoaderData, useParams } from '@tanstack/react-router'
import { ShopCustomerDetailPage as ShopCustomerDetailPageComponent } from '#/components/studio/ShopCustomerDetailPage'

export function ShopCustomerDetailPage() {
  const { shopId } = useParams({ from: '/studio/$shopId/customers/$customerHash' })
  const { customer } = useLoaderData({ from: '/studio/$shopId/customers/$customerHash' })

  return <ShopCustomerDetailPageComponent shopId={shopId} customer={customer} />
}
