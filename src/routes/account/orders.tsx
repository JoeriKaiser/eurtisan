import { createFileRoute, Outlet } from '@tanstack/react-router'
import { createPrivateLayoutMeta } from '#/lib/seo'
import { guardAuth } from '#/lib/route-guards'

export const Route = createFileRoute('/account/orders')({
  beforeLoad: async () => guardAuth(),
  head: () => createPrivateLayoutMeta(),
  component: AccountOrdersLayout,
})

function AccountOrdersLayout() {
  return <Outlet />
}
