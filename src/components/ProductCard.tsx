import { Link } from '@tanstack/react-router'
import { ImageOff, PackageX, Store } from 'lucide-react'
import { formatPriceEUR } from '#/lib/pricing'
import type { PublicProduct } from '#/lib/products'
import { m } from '#/paraglide/messages'

export interface ProductCardProps {
  product: PublicProduct
  imageUrl?: string | null
}

export default function ProductCard({ product, imageUrl }: ProductCardProps) {
  const isOutOfStock = product.stockCount <= 0

  return (
    <Link
      to='/products/$productSlug'
      params={{ productSlug: product.slug }}
      className={`island-shell group relative flex flex-col overflow-hidden rounded-2xl transition hover:border-[color-mix(in_oklab,var(--lagoon-deep)_35%,var(--line))] ${isOutOfStock ? 'opacity-75' : ''}`}
      aria-label={m.product_card_label({ name: product.name })}
    >
      {/* Image */}
      <div className='relative aspect-[4/3] w-full overflow-hidden bg-[var(--sand)]'>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]'
            loading='lazy'
          />
        ) : (
          <div className='flex h-full w-full items-center justify-center text-[var(--sea-ink-soft)]'>
            <ImageOff size={40} strokeWidth={1.5} aria-hidden='true' />
            <span className='sr-only'>{m.product_no_image()}</span>
          </div>
        )}

        {isOutOfStock && (
          <div className='absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]'>
            <span className='rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--sea-ink)] shadow-sm'>
              <PackageX size={14} className='inline align-text-bottom mr-1' aria-hidden='true' />
              {m.product_out_of_stock()}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className='flex flex-1 flex-col p-4'>
        <h3 className='mb-1 text-base font-semibold text-[var(--sea-ink)] line-clamp-1'>
          {product.name}
        </h3>

        {product.description && (
          <p className='mb-3 text-sm text-[var(--sea-ink-soft)] line-clamp-2'>
            {product.description}
          </p>
        )}

        <div className='mt-auto flex items-end justify-between gap-2'>
          <span className='text-base font-bold text-[var(--sea-ink)]'>
            {formatPriceEUR(product.priceCents)}
          </span>

          <span className='inline-flex items-center gap-1 rounded-full bg-[var(--chip-bg)] px-2 py-1 text-xs text-[var(--sea-ink-soft)] border border-[var(--chip-line)]'>
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
