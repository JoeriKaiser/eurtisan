import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/shops/$shopSlug')({
  component: () => <Outlet />,
})
