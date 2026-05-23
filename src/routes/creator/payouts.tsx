import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { CreatorPayoutsError, CreatorPayoutsLoading } from '#/components/CreatorPayoutsPage'
import { CreatorPayoutsRouteComponent } from '#/route-components/creator/payouts'
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
  loaderDeps: ({ search: { shopId, status, page } }) => ({ shopId, status, page }),
  loader: async ({ deps }) => {
    const shops = await getCreatorShops()
    const targetShop = shops.find((s) => s.id === deps.shopId) ?? shops[0] ?? null

    let payouts: Awaited<ReturnType<typeof listCreatorPayouts>> = {
      payouts: [],
      total: 0,
      page: deps.page,
      pageSize: 20,
      totalPages: 0,
    }

    if (targetShop) {
      payouts = await listCreatorPayouts({
        data: {
          shopId: targetShop.id,
          page: deps.page,
          pageSize: 20,
          status: deps.status,
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
