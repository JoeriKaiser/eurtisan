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
    <section aria-labelledby='products-heading' className='py-12 sm:py-16'>
      <div className='mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4'>
        <div>
          <h2
            id='products-heading'
            className='display-title text-3xl sm:text-4xl font-bold tracking-tight text-text-primary'
          >
            {m.home_products_title()}
          </h2>
          <p className='mt-1 text-xs sm:text-sm text-text-secondary font-sans'>
            {m.home_products_subtitle()}
          </p>
        </div>
        <Link
          to='/search'
          className='text-xs font-semibold text-accent-primary hover:text-accent-primary-hover no-underline inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto'
        >
          <span>View all products</span>
          <ArrowRight size={14} aria-hidden='true' />
        </Link>
      </div>

      {products.length === 0 ? (
        <div className='rounded-2xl border border-border-subtle bg-surface-default p-10 sm:p-14 text-center'>
          <div className='max-w-md mx-auto flex flex-col items-center'>
            <div className='size-12 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary mb-4'>
              <Package size={24} strokeWidth={1.5} aria-hidden='true' />
            </div>
            <h3 className='mb-2 text-xl font-bold text-text-primary display-title'>
              {m.home_products_empty_title()}
            </h3>
            <p className='mb-6 text-text-secondary font-sans text-xs sm:text-sm leading-relaxed'>
              {m.home_products_empty_desc()}
            </p>
            <Link
              to='/category/all'
              className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-2.5 text-xs font-semibold text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active transition-colors no-underline'
            >
              <span>{m.home_products_empty_cta()}</span>
              <ArrowRight size={14} aria-hidden='true' />
            </Link>
          </div>
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
          {products.map((product) => (
            <div key={product.id}>
              <ProductCard product={product} imageUrl={product.image?.url ?? null} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
