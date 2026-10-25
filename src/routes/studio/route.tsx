import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardPrivilegedRole } from '#/lib/route-guards'
import { createPrivateLayoutMeta } from '#/lib/seo'

export const Route = createFileRoute('/studio')({
  beforeLoad: async () => guardPrivilegedRole('creator'),
  head: () => createPrivateLayoutMeta(),
  component: StudioLayout,
})

function StudioLayout() {
  return <Outlet />
}
