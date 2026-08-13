import { Link } from '@tanstack/react-router'
import ProductGrid from '#/components/ProductGrid'
import type { PublicProduct } from '#/lib/products.server'
import { m } from '#/paraglide/messages'

export interface MoreFromShopProps {
  products: PublicProduct[]
  shopSlug: string
  shopName: string | null
}

/**
 * Other products from the same maker.
 *
 * **Not** "related products". There is no recommender in this codebase, and one
 * synthesised from category adjacency produces a rail of things that merely
 * share a label — which is worse than no rail, because it looks like a
 * recommendation and is not. Same shop is a relationship the buyer already
 * understands and the data already expresses.
 *
 * Reuses `ProductGrid` so cards, pricing, VAT lines, and out-of-stock treatment
 * cannot drift from every other listing surface.
 */
export function MoreFromShop({ products, shopSlug, shopName }: MoreFromShopProps) {
  if (products.length === 0) return null

  return (
    <section className='mt-8' aria-labelledby='more-from-shop-heading'>
      <div className='mb-4 flex flex-wrap items-baseline justify-between gap-3'>
        <h2 id='more-from-shop-heading' className='text-xl font-semibold text-text-primary'>
          {shopName ? m.product_more_from_shop({ shopName }) : m.product_more_from_shop_generic()}
        </h2>
        <Link
          to='/shops/$shopSlug'
          params={{ shopSlug }}
          className='text-sm font-medium text-text-secondary no-underline hover:text-text-primary hover:underline'
        >
          {m.product_view_all_from_shop()}
        </Link>
      </div>

      {/* No pagination: this is a rail, and the storefront link above is the
          path to the rest. `totalPages={1}` keeps ProductGrid from rendering
          controls that would page nothing. */}
      <ProductGrid products={products} page={1} totalPages={1} />
    </section>
  )
}
