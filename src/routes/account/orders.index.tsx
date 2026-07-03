import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { AccountOrders } from '#/route-components/account/orders'
import { AccountShell } from '#/components/AccountShell'
import { listBuyerOrders } from '#/lib/orders'
import { m } from '#/paraglide/messages'

const ordersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(1),
})

const PAGE_SIZE = 10

export const Route = createFileRoute('/account/orders/')({
  validateSearch: ordersSearchSchema,
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ deps }) => {
    const page = deps.page
    const offset = (page - 1) * PAGE_SIZE
    const result = await listBuyerOrders({ data: { limit: PAGE_SIZE, offset } })
    return { ...result, page }
  },
  head: () => ({
    meta: [
      { title: `${m.account_orders()} | Eurtisan` },
      { name: 'description', content: m.account_orders() },
    ],
  }),
  component: AccountOrdersRoute,
})

function AccountOrdersRoute() {
  return (
    <AccountShell
      breadcrumbs={[
        { label: m.nav_home(), to: '/' },
        { label: m.account_title(), to: '/account' },
        { label: m.account_orders() },
      ]}
    >
      <AccountOrders />
    </AccountShell>
  )
}
