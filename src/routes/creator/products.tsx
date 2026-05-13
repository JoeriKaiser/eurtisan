import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

/**
 * Layout route for /creator/products.
 * Protects all child routes and provides shared metadata.
 */
export const Route = createFileRoute('/creator/products')({
  beforeLoad: async () => guardRole('creator'),
  head: () => ({
    meta: [
      { title: `${m.creator_products_title()} | Eurtisan` },
      { name: 'description', content: m.creator_products_description() },
    ],
  }),
  component: () => <Outlet />,
})
