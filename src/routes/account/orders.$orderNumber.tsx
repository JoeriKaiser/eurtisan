import { createFileRoute, notFound } from '@tanstack/react-router'
import { AccountShell } from '#/components/AccountShell'
import { NotFoundPage } from '#/components/NotFoundPage'
import { OrderDetailRouteComponent } from '#/route-components/account/orders.$orderNumber'
import { getBuyerOrderDetailByOrderNumber } from '#/lib/orders'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/account/orders/$orderNumber')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    try {
      const order = await getBuyerOrderDetailByOrderNumber({
        data: { orderNumber: params.orderNumber },
      })
      return { order }
    } catch (err) {
      if (err instanceof Response && err.status === 404) {
        throw notFound()
      }
      throw err
    }
  },
  head: () => ({
    meta: [
      { title: `${m.order_detail_title()} | Eurtisan` },
      { name: 'description', content: m.order_detail_title() },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: OrderDetailRouteWrapper,
})

function OrderDetailRouteWrapper() {
  return (
    <AccountShell
      breadcrumbs={[
        { label: m.nav_home(), to: '/' },
        { label: m.account_title(), to: '/account' },
        { label: m.account_orders(), to: '/account/orders' },
        { label: m.order_detail_title() },
      ]}
    >
      <OrderDetailRouteComponent />
    </AccountShell>
  )
}
