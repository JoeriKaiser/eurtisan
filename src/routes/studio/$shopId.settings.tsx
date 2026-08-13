import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardShopOwnership } from '#/lib/route-guards'

export const Route = createFileRoute('/studio/$shopId/settings')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  component: SettingsLayout,
})

function SettingsLayout() {
  return <Outlet />
}
