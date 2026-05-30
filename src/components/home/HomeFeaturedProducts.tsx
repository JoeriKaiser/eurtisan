import { Link } from '@tanstack/react-router'
import { ArrowRight, Package } from 'lucide-react'
import type { RecentProduct } from '#/lib/products'
import { m } from '#/paraglide/messages'
import ProductCard from '../ProductCard'

interface HomeFeaturedProductsProps {
  products: RecentProduct[]
}

export function HomeFeaturedProducts({ products }: HomeFeaturedProductsProps) {
  return (
    <section aria-labelledby='products-heading'>
      <div className='mb-8 flex items-end justify-between gap-4'>
        <div>
          <h2
            id='products-heading'
            className='display-title text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl'
          >
            {m.home_products_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary font-sans'>{m.home_products_subtitle()}</p>
        </div>
        <Link
          to='/search'
          className='group text-sm font-bold text-accent-primary hover:text-accent-primary-hover no-underline inline-flex items-center gap-1 transition-colors'
        >
          View all products
          <ArrowRight size={16} className='transition-transform group-hover:translate-x-0.5' />
        </Link>
      </div>

      {products.length === 0 ? (
        <div className='island-shell rounded-2xl p-8 text-center sm:p-12'>
          <Package size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <h3 className='mb-2 text-lg font-semibold text-text-primary display-title'>
            {m.home_products_empty_title()}
          </h3>
          <p className='mb-6 text-text-secondary font-sans text-sm max-w-md mx-auto'>
            {m.home_products_empty_desc()}
          </p>
          <Link
            to='/category/all'
            className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-semibold text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
          >
            {m.home_products_empty_cta()}
          </Link>
        </div>
      ) : (
        <div className='grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} imageUrl={product.image?.url ?? null} />
          ))}
        </div>
      )}
    </section>
  )
}
