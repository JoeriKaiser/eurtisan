import { createFileRoute } from '@tanstack/react-router'
import { guardShopOwnership } from '#/lib/route-guards'
import { getShopCustomerDetail } from '#/lib/customers'
import { ShopCustomerDetailPage } from '#/route-components/studio/$shopId.customers.$customerHash'
import { ShopCustomerDetailPending } from '#/route-components/studio/$shopId.customers.$customerHash.pending'
import { ShopCustomerDetailError } from '#/route-components/studio/$shopId.customers.$customerHash.error'

export const Route = createFileRoute('/studio/$shopId/customers/$customerHash')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  loader: async ({ params }) => {
    const customer = await getShopCustomerDetail({
      data: {
        shopId: params.shopId,
        customerEmailHash: params.customerHash,
      },
    })
    return { customer }
  },
  head: () => ({
    meta: [{ title: 'Customer | Studio' }],
  }),
  component: ShopCustomerDetailPage,
  pendingComponent: ShopCustomerDetailPending,
  errorComponent: ShopCustomerDetailError,
})
