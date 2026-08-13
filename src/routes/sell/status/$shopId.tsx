import { createFileRoute } from '@tanstack/react-router'
import { ShopStatusRouteComponent } from '#/route-components/sell/status/$shopId'
import { getShopStatus } from '#/lib/sell-onboarding'
import { guardAuth } from '#/lib/route-guards'
import { StatusError } from '#/route-components/sell/status/StatusError'
import { StatusPending } from '#/route-components/sell/status/StatusPending'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/sell/status/$shopId')({
  head: () => ({
    meta: [
      {
        title: m.onboarding_status_meta_title({ shopName: m.app_name() }),
      },
      { name: 'description', content: m.onboarding_status_meta_description() },
    ],
  }),
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    const status = await getShopStatus({ data: { shopId: params.shopId } })
    return { status }
  },
  component: ShopStatusRouteComponent,
  pendingComponent: StatusPending,
  errorComponent: StatusError,
})
