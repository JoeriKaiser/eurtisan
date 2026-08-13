import { Link } from '@tanstack/react-router'
import { Store } from 'lucide-react'
import ProductImagePlaceholder from '#/components/ProductImagePlaceholder'
import { UnitPriceNote } from '#/components/product/UnitPriceNote'
import { cn } from '#/lib/cn'
import { getImageUrl } from '#/lib/image-url'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import HighlightedText from './HighlightedText'

/**
 * Minimal shape the card needs, so it can render results coming either from the
 * search index or from the PostgreSQL fallback.
 */
export interface SearchResultCardProduct {
  name: string
  description?: string | null
  slug: string
  shopSlug: string | null
  shopName?: string | null
  priceCents: number
  stockCount: number
  weightGrams: number | null
  volumeMl: number | null
  soldBy: 'weight' | 'volume' | null
}

interface SearchResultCardProps {
  product: SearchResultCardProduct
  imageUrl?: string | null
  /** Engine-highlighted product name, when available. */
  formattedName?: string | null
  onSelect?: () => void
}

export default function SearchResultCard({
  product,
  imageUrl,
  formattedName,
  onSelect,
}: SearchResultCardProps) {
  const isOutOfStock = product.stockCount <= 0

  return (
    <Link
      to='/shops/$shopSlug/products/$productSlug'
      params={{ shopSlug: product.shopSlug ?? 'unknown', productSlug: product.slug }}
      onClick={onSelect}
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
            src={getImageUrl(imageUrl, { width: 128, format: 'webp' })}
            alt={product.name}
            loading='lazy'
            className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]'
          />
        ) : (
          <ProductImagePlaceholder iconSize={20} />
        )}
      </div>

      {/* Info */}
      <div className='min-w-0 flex-1'>
        <h4 className='text-sm font-semibold text-text-primary line-clamp-1'>
          <HighlightedText formatted={formattedName ?? null} fallback={product.name} />
        </h4>
        {product.description && (
          <p className='mt-0.5 text-xs text-text-secondary line-clamp-1'>{product.description}</p>
        )}
        <div className='mt-1.5 flex items-center gap-2'>
          <span className='text-sm font-bold text-text-primary'>
            {formatPriceEUR(product.priceCents)}
          </span>
          <span className='inline-flex items-center gap-1 text-xs text-text-muted'>
            <Store size={10} aria-hidden='true' />
            <span className='max-w-[100px] truncate'>
              {product.shopName ?? m.search_unknown_shop()}
            </span>
          </span>
          {isOutOfStock ? (
            <span className='text-xs font-medium text-text-muted'>{m.search_out_of_stock()}</span>
          ) : null}
        </div>
        <UnitPriceNote
          priceCents={product.priceCents}
          soldBy={product.soldBy}
          weightGrams={product.weightGrams}
          volumeMl={product.volumeMl}
        />
      </div>
    </Link>
  )
}
