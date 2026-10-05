import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/creator/products')({
  component: () => <Outlet />,
})
