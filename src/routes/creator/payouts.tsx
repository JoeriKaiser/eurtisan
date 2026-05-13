import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import {
  CreatorPayoutsError,
  CreatorPayoutsLoading,
  CreatorPayoutsPage,
} from '#/components/CreatorPayoutsPage'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { listCreatorPayouts } from '#/lib/payouts'
import { m } from '#/paraglide/messages'

const payoutSearchSchema = z.object({
  shopId: z.string().optional(),
  status: z.enum(['all', 'pending', 'processing', 'sent']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
})

export const Route = createFileRoute('/creator/payouts')({
  validateSearch: payoutSearchSchema,
  loader: async ({ search }) => {
    const shops = await getCreatorShops()
    const targetShop = shops.find((s) => s.id === search.shopId) ?? shops[0] ?? null

    let payouts: Awaited<ReturnType<typeof listCreatorPayouts>> = {
      payouts: [],
      total: 0,
      page: search.page,
      pageSize: 20,
      totalPages: 0,
    }

    if (targetShop) {
      payouts = await listCreatorPayouts({
        data: {
          shopId: targetShop.id,
          page: search.page,
          pageSize: 20,
          status: search.status,
        },
      })
    }

    return { shops, payouts, currentShopId: targetShop?.id ?? null }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_payouts_title()} | Eurtisan` },
      { name: 'description', content: m.creator_payouts_description() },
    ],
  }),
  component: CreatorPayoutsRouteComponent,
  pendingComponent: CreatorPayoutsLoading,
  errorComponent: CreatorPayoutsError,
})

function CreatorPayoutsRouteComponent() {
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
