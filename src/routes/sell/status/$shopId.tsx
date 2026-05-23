import { createFileRoute } from '@tanstack/react-router'
import { ShopStatusRouteComponent } from '#/route-components/sell/status/$shopId'
import { getShopStatus } from '#/lib/sell-onboarding'
import { guardAuth } from '#/lib/route-guards'

export const Route = createFileRoute('/sell/status/$shopId')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    const status = await getShopStatus({ data: { shopId: params.shopId } })
    return { status }
  },
  component: ShopStatusRouteComponent,
})
