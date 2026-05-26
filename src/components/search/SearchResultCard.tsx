import { Link } from '@tanstack/react-router'
import { ImageOff, Store } from 'lucide-react'
import { cn } from '#/lib/cn'
import { formatPriceEUR } from '#/lib/pricing'
import type { PublicProduct } from '#/lib/products'

interface SearchResultCardProps {
  product: PublicProduct
  imageUrl?: string | null
}

export default function SearchResultCard({ product, imageUrl }: SearchResultCardProps) {
  const isOutOfStock = product.stockCount <= 0

  return (
    <Link
      to='/shops/$shopSlug/products/$productSlug'
      params={{ shopSlug: product.shopSlug ?? 'unknown', productSlug: product.slug }}
      className={cn(
        'group flex items-start gap-3 rounded-xl border border-border-default bg-surface-default p-3 transition-colors',
        'hover:border-border-strong hover:bg-bg-inset',
        isOutOfStock && 'opacity-60',
      )}
    >
      {/* Thumbnail */}
      <div className='relative size-16 shrink-0 overflow-hidden rounded-lg bg-surface-inset'>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            loading='lazy'
            className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]'
          />
        ) : (
          <div className='flex h-full w-full items-center justify-center text-text-muted'>
            <ImageOff size={20} strokeWidth={1.5} aria-hidden='true' />
          </div>
        )}
      </div>

      {/* Info */}
      <div className='min-w-0 flex-1'>
        <h4 className='text-sm font-semibold text-text-primary line-clamp-1'>{product.name}</h4>
        {product.description && (
          <p className='mt-0.5 text-xs text-text-secondary line-clamp-1'>{product.description}</p>
        )}
        <div className='mt-1.5 flex items-center gap-2'>
          <span className='text-sm font-bold text-text-primary'>
            {formatPriceEUR(product.priceCents)}
          </span>
          <span className='inline-flex items-center gap-1 text-xs text-text-muted'>
            <Store size={10} aria-hidden='true' />
            <span className='max-w-[100px] truncate'>{product.shopName ?? 'Unknown shop'}</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
