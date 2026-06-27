import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/disputes')({
  component: AdminDisputesLayout,
})

function AdminDisputesLayout() {
  return <Outlet />
}
