import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardPrivilegedRole } from '#/lib/route-guards'

export const Route = createFileRoute('/studio')({
  beforeLoad: async () => guardPrivilegedRole('creator'),
  component: StudioLayout,
})

function StudioLayout() {
  return <Outlet />
}
