import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { CreatorPayoutsError } from '#/components/CreatorPayoutsError'
import { CreatorPayoutsLoading } from '#/components/CreatorPayoutsLoading'
import { CreatorPayoutsPage } from '#/components/CreatorPayoutsPage'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { listCreatorPayouts } from '#/lib/payouts'
import { guardShopOwnership } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

const payoutSearchSchema = z.object({
  status: z
    .enum(['all', 'pending', 'in_transit', 'sent', 'failed', 'reversed'])
    .optional()
    .default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export const Route = createFileRoute('/studio/$shopId/payouts')({
  validateSearch: payoutSearchSchema,
  loaderDeps: ({ search: { status, page } }) => ({ status, page }),
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  loader: async ({ params, deps }) => {
    const shops = await getCreatorShops()
    const payouts = await listCreatorPayouts({
      data: {
        shopId: params.shopId,
        page: deps.page,
        pageSize: 20,
        status: deps.status,
      },
    })

    return { shops, payouts, currentShopId: params.shopId }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_payouts_title()} | Eurtisan` },
      { name: 'description', content: m.creator_payouts_description() },
    ],
  }),
  component: ShopPayoutsRoute,
  pendingComponent: CreatorPayoutsLoading,
  errorComponent: CreatorPayoutsError,
})

function ShopPayoutsRoute() {
  const { shops, payouts, currentShopId } = Route.useLoaderData()
  const search = Route.useSearch()
  return (
    <CreatorPayoutsPage
      shops={shops}
      payouts={payouts}
      currentShopId={currentShopId}
      initialStatus={search.status}
    />
  )
}
