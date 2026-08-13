import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Store } from 'lucide-react'
import { getShopBySlug } from '#/lib/products'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/shops/$shopSlug')({
  loader: async ({ params }) => {
    try {
      const shop = await getShopBySlug({ data: { slug: params.shopSlug } })
      return { shop }
    } catch {
      return { shop: null }
    }
  },
  component: function ShopLayout() {
    const { shop } = Route.useLoaderData()
    return (
      <div className='min-h-screen'>
        {shop && (
          <header className='border-b border-border-subtle bg-surface-default'>
            <div className='page-wrap flex items-center gap-3 px-4 py-4'>
              <Store size={20} className='text-accent-primary' aria-hidden='true' />
              <Link
                to='/shops/$shopSlug'
                params={{ shopSlug: shop.slug }}
                className='text-lg font-semibold text-text-primary hover:text-accent-primary'
              >
                {shop.name}
              </Link>
              <nav className='ml-auto flex gap-4 text-sm'>
                <Link
                  to='/shops/$shopSlug'
                  params={{ shopSlug: shop.slug }}
                  className='text-text-secondary hover:text-text-primary'
                >
                  {m.shop_nav_products()}
                </Link>
              </nav>
            </div>
          </header>
        )}
        {/* No <main> here: every child route renders its own, and nested main
            landmarks break assistive navigation. */}
        <Outlet />
      </div>
    )
  },
})
