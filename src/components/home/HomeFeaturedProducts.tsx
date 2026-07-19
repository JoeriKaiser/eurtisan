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
    <section aria-labelledby='products-heading' className='py-8 animate-fade-in-up'>
      <div className='mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4'>
        <div>
          <h2
            id='products-heading'
            className='display-title text-3xl font-bold tracking-tight text-text-primary sm:text-4xl'
          >
            {m.home_products_title()}
          </h2>
          <p className='mt-1.5 text-xs sm:text-sm text-text-secondary font-sans'>
            {m.home_products_subtitle()}
          </p>
        </div>
        <Link
          to='/search'
          className='group text-sm font-bold text-accent-primary hover:text-accent-primary-hover no-underline inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto'
        >
          View all products
          <ArrowRight
            size={15}
            className='transition-transform duration-300 group-hover:translate-x-1'
          />
        </Link>
      </div>

      {products.length === 0 ? (
        /* Double-Bezel outer shell */
        <div className='p-2 rounded-[2rem] bg-scrim-subtle border border-border-subtle shadow-md'>
          {/* Inner core */}
          <div className='bg-bg-elevated rounded-[calc(2rem-0.5rem)] p-8 sm:p-14 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'>
            <div className='max-w-md mx-auto flex flex-col items-center'>
              <div className='size-14 rounded-full bg-accent-primary-subtle flex items-center justify-center text-accent-primary mb-5 border border-accent-primary/10'>
                <Package size={26} strokeWidth={1.5} aria-hidden='true' />
              </div>
              <h3 className='mb-2 text-xl font-bold text-text-primary display-title'>
                {m.home_products_empty_title()}
              </h3>
              <p className='mb-8 text-text-secondary font-sans text-xs sm:text-sm leading-relaxed'>
                {m.home_products_empty_desc()}
              </p>
              <Link
                to='/category/all'
                className='group inline-flex items-center justify-between gap-3 h-12 pl-6 pr-2 bg-accent-primary text-text-on-primary rounded-full font-semibold shadow-md active:scale-[0.98] transition-all no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
              >
                <span>{m.home_products_empty_cta()}</span>
                <span className='flex size-6 rounded-full bg-scrim-subtle group-hover:bg-scrim items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]'>
                  <ArrowRight size={14} />
                </span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className='flex gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:pb-0 lg:grid-cols-4'>
          {products.map((product) => (
            <div key={product.id} className='grid min-w-[82vw] sm:min-w-0'>
              <ProductCard product={product} imageUrl={product.image?.url ?? null} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
