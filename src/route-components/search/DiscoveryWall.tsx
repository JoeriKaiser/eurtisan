import { Link } from '@tanstack/react-router'
import ProductImagePlaceholder from '#/components/ProductImagePlaceholder'
import { formatPriceEUR } from '#/lib/pricing'
import type { PublicProduct } from '#/lib/products'
import { ResponsiveImage } from '#/lib/responsive-image'
import { getProductImageTransitionName } from '#/lib/view-transitions'
import { m } from '#/paraglide/messages'

interface DiscoveryWallProps {
  products: PublicProduct[]
}

const tilePatterns = [
  'col-span-2 md:col-span-2 md:row-span-2',
  'row-span-1',
  'row-span-2',
  'row-span-1',
  'row-span-1',
  'col-span-2 row-span-1',
  'row-span-2',
  'row-span-1',
  'row-span-1',
  'col-span-2 md:col-span-2 md:row-span-2',
  'row-span-1',
  'row-span-2',
]

export function DiscoveryWall({ products }: DiscoveryWallProps) {
  const linkedProducts = products.filter(
    (product): product is PublicProduct & { shopSlug: string } => Boolean(product.shopSlug),
  )

  return (
    <div className='grid auto-rows-[12rem] grid-flow-dense grid-cols-2 gap-2 sm:auto-rows-[15rem] sm:gap-3 md:grid-cols-4 lg:grid-cols-5'>
      {linkedProducts.map((product, index) => (
        <Link
          key={product.id}
          to='/shops/$shopSlug/products/$productSlug'
          params={{ shopSlug: product.shopSlug, productSlug: product.slug }}
          className={`group relative min-h-0 overflow-hidden rounded-2xl bg-surface-inset no-underline ${tilePatterns[index % tilePatterns.length]}`}
          aria-label={m.product_card_label({ name: product.name })}
        >
          <div
            className='absolute inset-0 overflow-hidden rounded-[inherit]'
            style={{ viewTransitionName: getProductImageTransitionName(product.id) }}
          >
            {product.imageUrl ? (
              <ResponsiveImage
                src={product.imageUrl}
                alt={product.name}
                loading={index < 6 ? 'eager' : 'lazy'}
                widths={[400, 800, 1200]}
                sizes='(max-width: 639px) 50vw, (max-width: 1023px) 25vw, 20vw'
                className='h-full w-full'
                imgClassName='h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]'
              />
            ) : (
              <ProductImagePlaceholder />
            )}
          </div>
          <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim-image via-scrim-image-subtle to-transparent px-3 pb-3 pt-12 text-[var(--palette-walnut-50)] sm:px-4 sm:pb-4 sm:pt-16'>
            <p className='line-clamp-2 text-sm font-semibold leading-snug sm:text-base'>
              {product.name}
            </p>
            <div className='mt-1.5 flex items-end justify-between gap-2 text-xs text-[color:var(--palette-walnut-100)]'>
              {product.shopName ? <span className='truncate'>{product.shopName}</span> : <span />}
              <span className='shrink-0 font-semibold tabular-nums text-[var(--palette-walnut-50)]'>
                {formatPriceEUR(product.priceCents)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
