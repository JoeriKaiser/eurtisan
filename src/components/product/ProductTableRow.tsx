import { Link } from '@tanstack/react-router'
import { Edit, ImageOff, ToggleLeft, ToggleRight } from 'lucide-react'
import { formatPriceEUR } from '#/lib/pricing'
import { getImageUrl } from '#/lib/image-url'
import { m } from '#/paraglide/messages'
import { Badge } from '../ui/badge'

export interface CreatorProduct {
  id: string
  name: string
  slug: string
  priceCents: number
  stockCount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  thumbnailUrl: string | null
}

interface ProductTableRowProps {
  product: CreatorProduct
  currentShopId: string | null
  active: boolean
  toggling: boolean
  onToggle: (productId: string, shopId: string, currentActive: boolean) => void
}

export function ProductTableRow({
  product,
  currentShopId,
  active,
  toggling,
  onToggle,
}: ProductTableRowProps) {
  return (
    <tr
      key={product.id}
      className='border-b border-border-subtle transition-colors hover:bg-bg-inset'
    >
      {/* Product cell with thumbnail */}
      <td className='py-3 pr-4'>
        <div className='flex items-center gap-3'>
          <div className='size-10 flex-shrink-0 overflow-hidden rounded-lg bg-surface-inset'>
            {product.thumbnailUrl ? (
              <img
                src={getImageUrl(product.thumbnailUrl, { width: 80, format: 'webp' })}
                alt=''
                className='h-full w-full object-cover'
                loading='lazy'
              />
            ) : (
              <div className='flex h-full w-full items-center justify-center text-text-muted'>
                <ImageOff size={16} aria-hidden='true' />
              </div>
            )}
          </div>
          <div className='min-w-0'>
            <p className='font-medium text-text-primary truncate'>{product.name}</p>
            <p className='text-xs text-text-muted sm:hidden'>
              {formatPriceEUR(product.priceCents)}
              <span className='mx-1.5'>·</span>
              {m.creator_products_stock_count({ count: product.stockCount })}
            </p>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className='py-3 pr-4 hidden sm:table-cell'>
        <span className='text-text-primary'>{formatPriceEUR(product.priceCents)}</span>
      </td>

      {/* Stock */}
      <td className='py-3 pr-4 hidden md:table-cell'>
        <span
          className={
            product.stockCount === 0
              ? 'text-error'
              : product.stockCount < 5
                ? 'text-warning'
                : 'text-text-primary'
          }
        >
          {product.stockCount}
        </span>
      </td>

      {/* Status badge */}
      <td className='py-3 pr-4'>
        <Badge variant={active ? 'success' : 'secondary'}>
          {active ? m.creator_products_status_active() : m.creator_products_status_inactive()}
        </Badge>
      </td>

      {/* Actions */}
      <td className='py-3 text-right'>
        <div className='flex items-center justify-end gap-2'>
          {/* Toggle button */}
          {currentShopId && (
            <button
              type='button'
              onClick={() => onToggle(product.id, currentShopId, active)}
              disabled={toggling}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-success-subtle text-success hover:bg-success/10'
                  : 'bg-surface-inset text-text-secondary hover:bg-surface-default hover:text-text-primary'
              } disabled:opacity-50`}
              aria-label={
                active
                  ? m.creator_products_deactivate({ name: product.name })
                  : m.creator_products_activate({ name: product.name })
              }
            >
              {toggling ? (
                <svg
                  className='size-4 animate-spin'
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  />
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  />
                </svg>
              ) : active ? (
                <ToggleRight size={16} aria-hidden='true' />
              ) : (
                <ToggleLeft size={16} aria-hidden='true' />
              )}
              {active ? m.creator_products_active() : m.creator_products_inactive()}
            </button>
          )}

          {/* Edit link */}
          {currentShopId && (
            <Link
              to='/creator/products/$productId/edit'
              params={{ productId: product.id }}
              className='inline-flex items-center justify-center rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-inset hover:text-text-primary'
              aria-label={m.creator_products_edit({ name: product.name })}
            >
              <Edit size={16} aria-hidden='true' />
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}
