import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

/**
 * Layout route for /creator/products.
 * KAI-108 provides the full product list page; this is a minimal
 * layout shell so child routes like /new can be mounted.
 */
export const Route = createFileRoute('/creator/products')({
  beforeLoad: async () => guardRole('creator'),
  head: () => ({
    meta: [
      { title: `${m.creator_product_new_title()} | Eurtisan` },
    ],
  }),
  component: () => <Outlet />,
})
