import { Link } from '@tanstack/react-router'
import { PackageX, Store } from 'lucide-react'
import { formatPriceEUR } from '#/lib/pricing'
import type { PublicProduct } from '#/lib/products'
import { getProductImageTransitionName } from '#/lib/view-transitions'
import { ResponsiveImage } from '#/lib/responsive-image'
import { m } from '#/paraglide/messages'
import ProductImagePlaceholder from './ProductImagePlaceholder'

export interface ProductCardProps {
  product: PublicProduct
  imageUrl?: string | null
}

export default function ProductCard({ product, imageUrl }: ProductCardProps) {
  const isOutOfStock = product.stockCount <= 0

  return (
    <Link
      to='/shops/$shopSlug/products/$productSlug'
      params={{ shopSlug: product.shopSlug ?? 'unknown', productSlug: product.slug }}
      className={`island-shell group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-fast ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md ${isOutOfStock ? 'opacity-75' : ''}`}
      aria-label={m.product_card_label({ name: product.name })}
    >
      {/* Image */}
      <div
        className='relative aspect-[4/3] w-full overflow-hidden bg-surface-inset'
        style={{ viewTransitionName: getProductImageTransitionName(product.id) }}
      >
        {imageUrl ? (
          <ResponsiveImage
            src={imageUrl}
            alt={product.name}
            loading='lazy'
            sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw'
            className='h-full w-full'
            imgClassName='h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]'
          />
        ) : (
          <ProductImagePlaceholder />
        )}

        {isOutOfStock && (
          <div className='absolute inset-0 flex items-center justify-center bg-scrim-image-subtle backdrop-blur-[1px]'>
            <span className='rounded-full bg-surface-default px-3 py-1 text-xs font-semibold text-text-primary shadow-sm'>
              <PackageX size={14} className='inline align-text-bottom mr-1' aria-hidden='true' />
              {m.product_out_of_stock()}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className='flex flex-1 flex-col p-4'>
        <h3 className='mb-1 text-base font-semibold text-text-primary line-clamp-1'>
          {product.name}
        </h3>

        {product.description && (
          <p className='mb-3 text-sm text-text-secondary line-clamp-2'>{product.description}</p>
        )}

        <div className='mt-auto flex items-end justify-between gap-2'>
          <div className='flex flex-col'>
            <span className='text-base font-bold text-text-primary tabular-nums'>
              {formatPriceEUR(product.priceCents)}
            </span>
            <span className='text-[10px] text-text-muted'>
              {product.shopIsVatRegistered ? m.vat_included() : m.vat_exempt_short()}
            </span>
          </div>

          <span className='inline-flex items-center gap-1 rounded-full bg-surface-inset px-2 py-1 text-xs text-text-secondary border border-border-default'>
            <Store size={12} aria-hidden='true' />
            <span className='max-w-[120px] truncate'>
              {product.shopName ?? m.product_unknown_shop()}
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}
