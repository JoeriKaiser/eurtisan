import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowRight,
  ImageOff,
  Loader2,
  Minus,
  PackageX,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useCart } from '#/components/CartProvider'
import type { CartDetail, CartItemDetail, CartShopGroup } from '#/lib/cart.server'
import { useRemoveCartItem, useUpdateCartItem } from '#/lib/cart-hooks'
import { getCartDistinctItemCount, isCartEmpty } from '#/lib/cart-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from './ui/primitives/dialog'

export interface CartPageProps {
  cart: CartDetail | null
  showEmptyMessage?: boolean
}

export default function CartPage({ cart: initialCart, showEmptyMessage }: CartPageProps) {
  const { cart: liveCart } = useCart()
  const cart = liveCart ?? initialCart

  const updateCartItemMutation = useUpdateCartItem()
  const removeCartItemMutation = useRemoveCartItem()

  const [ops, setOps] = useState({
    updatingItemId: null as string | null,
    removingItemId: null as string | null,
    confirmRemoveItem: null as CartItemDetail | null,
    updateErrorItemId: null as string | null,
    removeErrorItemId: null as string | null,
  })

  const hasUnavailableItems =
    cart?.shops.some((shop) => shop.items.some((item) => item.unavailable)) ?? false

  const handleUpdateQuantity = async (productId: string, quantity: number) => {
    setOps((prev) => ({ ...prev, updateErrorItemId: null, updatingItemId: productId }))
    try {
      await updateCartItemMutation.mutateAsync({ productId, quantity })
    } catch {
      setOps((prev) => ({ ...prev, updateErrorItemId: productId }))
    } finally {
      setOps((prev) => ({ ...prev, updatingItemId: null }))
    }
  }

  const handleRemove = async (productId: string) => {
    setOps((prev) => ({ ...prev, removeErrorItemId: null, removingItemId: productId }))
    try {
      await removeCartItemMutation.mutateAsync({ productId })
    } catch {
      setOps((prev) => ({ ...prev, removeErrorItemId: productId }))
    } finally {
      setOps((prev) => ({ ...prev, removingItemId: null, confirmRemoveItem: null }))
    }
  }

  if (!cart || isCartEmpty(cart)) {
    return <EmptyCart showEmptyMessage={showEmptyMessage} />
  }

  const distinctItems = getCartDistinctItemCount(cart)

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      {showEmptyMessage && (
        <div className='mb-4 rounded-lg border border-warning bg-warning-subtle px-4 py-3 text-sm text-warning-strong'>
          {m.cart_empty_checkout_message()}
        </div>
      )}
      <div className='mb-8'>
        <h1 className='display-title text-3xl font-semibold text-text-primary sm:text-4xl'>
          {m.cart_title()}
        </h1>
        <p className='mt-1 text-sm text-text-secondary'>
          {distinctItems === 1
            ? m.cart_item_single()
            : m.cart_items_count({ count: String(distinctItems) })}
        </p>
      </div>

      <div className='grid gap-8 lg:grid-cols-[1fr_360px]'>
        {/* Cart items */}
        <div className='space-y-6'>
          {cart.shops.map((shop) => (
            <ShopGroup
              key={shop.shopId ?? 'unavailable'}
              shop={shop}
              updatingItemId={ops.updatingItemId}
              removingItemId={ops.removingItemId}
              updateErrorItemId={ops.updateErrorItemId}
              removeErrorItemId={ops.removeErrorItemId}
              onUpdateQuantity={handleUpdateQuantity}
              onRequestRemove={(item) => setOps((prev) => ({ ...prev, confirmRemoveItem: item }))}
            />
          ))}
        </div>

        {/* Order summary */}
        <div className='lg:sticky lg:top-24 lg:self-start'>
          <section className='island-shell rounded-2xl p-6'>
            <h2 className='mb-4 text-lg font-semibold text-text-primary'>{m.cart_total()}</h2>

            <div className='space-y-2'>
              {cart.shops.map((shop) => (
                <div key={shop.shopId ?? 'unavailable'} className='flex justify-between text-sm'>
                  <span className='text-text-secondary truncate'>
                    {shop.shopName ?? m.cart_item_unavailable()}
                    <span className='ml-1 text-[10px] text-text-muted'>
                      {shop.shopIsVatRegistered ? m.vat_included() : m.vat_exempt_short()}
                    </span>
                  </span>
                  <span className='font-medium text-text-primary'>
                    {formatPriceEUR(shop.subtotalCents)}
                  </span>
                </div>
              ))}
            </div>

            <div className='my-4 border-t border-border-default' />

            <div className='flex items-center justify-between'>
              <span className='text-base font-semibold text-text-primary'>{m.cart_total()}</span>
              <span className='text-xl font-bold text-text-primary'>
                {formatPriceEUR(cart.totalCents)}
              </span>
            </div>

            {hasUnavailableItems ? (
              <Button
                size='lg'
                className='mt-6 w-full'
                disabled
                aria-describedby='checkout-disabled-reason'
              >
                {m.cart_proceed_to_checkout()}
              </Button>
            ) : (
              <Link
                to='/checkout'
                className='mt-6 inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent-primary px-6 text-base font-medium text-text-on-primary no-underline shadow-sm transition-all duration-fast ease-out hover:bg-accent-primary-hover active:bg-accent-primary-active focus-visible:outline-none'
              >
                {m.cart_proceed_to_checkout()}
              </Link>
            )}

            {hasUnavailableItems && (
              <p
                id='checkout-disabled-reason'
                className='mt-2 flex items-center gap-1.5 text-xs text-error'
              >
                <AlertTriangle size={14} aria-hidden='true' />
                {m.cart_checkout_disabled_unavailable()}
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Remove confirmation dialog */}
      <Dialog
        open={ops.confirmRemoveItem !== null}
        onOpenChange={() => setOps((prev) => ({ ...prev, confirmRemoveItem: null }))}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup>
            <DialogTitle>{m.cart_item_remove_confirm_title()}</DialogTitle>
            <DialogDescription>{m.cart_item_remove_confirm_description()}</DialogDescription>
            <div className='mt-6 flex justify-end gap-3'>
              <Button
                variant='secondary'
                onClick={() => setOps((prev) => ({ ...prev, confirmRemoveItem: null }))}
              >
                {m.cart_item_remove_cancel_button()}
              </Button>
              <Button
                variant='danger'
                onClick={() => {
                  if (ops.confirmRemoveItem) {
                    void handleRemove(ops.confirmRemoveItem.productId)
                  }
                }}
                isLoading={ops.removingItemId === ops.confirmRemoveItem?.productId}
              >
                {m.cart_item_remove_confirm_button()}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </main>
  )
}

function EmptyCart({ showEmptyMessage }: { showEmptyMessage?: boolean }) {
  return (
    <main className='page-wrap px-4 py-20 text-center'>
      <div className='mx-auto max-w-md'>
        {showEmptyMessage && (
          <div className='mb-6 rounded-lg border border-warning bg-warning-subtle px-4 py-3 text-sm text-warning-strong'>
            {m.cart_empty_checkout_message()}
          </div>
        )}
        <div className='rounded-[2rem] border border-border-subtle bg-scrim-subtle p-2 shadow-md'>
          <div className='rounded-[calc(2rem-0.5rem)] bg-bg-elevated p-8 sm:p-12 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'>
            <div className='mx-auto mb-6 flex size-20 items-center justify-center rounded-full border border-accent-primary/10 bg-accent-primary-subtle text-accent-primary'>
              <ShoppingBag size={36} strokeWidth={1.5} aria-hidden='true' />
            </div>
            <h1 className='display-title mb-3 text-2xl font-semibold text-text-primary'>
              {m.cart_empty_title()}
            </h1>
            <p className='mb-8 text-text-secondary'>{m.cart_empty_description()}</p>
            <Link
              to='/category/all'
              className='group inline-flex h-12 items-center justify-between gap-3 rounded-full bg-accent-primary pl-6 pr-2 text-base font-semibold text-text-on-primary no-underline shadow-md transition-all duration-fast ease-out hover:bg-accent-primary-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
            >
              <span>{m.cart_empty_browse()}</span>
              <span className='flex size-6 items-center justify-center rounded-full bg-scrim-subtle transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]'>
                <ArrowRight size={14} aria-hidden='true' />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

interface ShopGroupProps {
  shop: CartShopGroup
  updatingItemId: string | null
  removingItemId: string | null
  updateErrorItemId: string | null
  removeErrorItemId: string | null
  onUpdateQuantity: (productId: string, quantity: number) => Promise<void>
  onRequestRemove: (item: CartItemDetail) => void
}

function ShopGroup({
  shop,
  updatingItemId,
  removingItemId,
  updateErrorItemId,
  removeErrorItemId,
  onUpdateQuantity,
  onRequestRemove,
}: ShopGroupProps) {
  const shopHasUnavailable = shop.items.some((item) => item.unavailable)

  return (
    <section className='island-shell rounded-2xl p-4 sm:p-6'>
      {/* Shop header */}
      <div className='mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border-default pb-4'>
        <div className='flex items-center gap-2'>
          <h2 className='text-base font-semibold text-text-primary'>
            {shop.shopName ?? m.cart_item_unavailable()}
          </h2>
          {shopHasUnavailable && <Badge variant='error'>{m.cart_item_unavailable()}</Badge>}
        </div>
        <div className='text-right'>
          <p className='text-sm text-text-secondary'>
            {m.cart_shop_subtotal()}{' '}
            <span className='font-semibold text-text-primary'>
              {formatPriceEUR(shop.subtotalCents)}
            </span>
          </p>
        </div>
      </div>

      {/* Items */}
      <ul className='divide-y divide-border-subtle'>
        {shop.items.map((item) => {
          let status: 'idle' | 'updating' | 'removing' | 'update-error' | 'remove-error' = 'idle'
          if (updatingItemId === item.productId) status = 'updating'
          else if (removingItemId === item.productId) status = 'removing'
          else if (updateErrorItemId === item.productId) status = 'update-error'
          else if (removeErrorItemId === item.productId) status = 'remove-error'

          return (
            <CartItemRow
              key={item.id}
              item={item}
              shopSlug={shop.shopSlug}
              status={status}
              onUpdateQuantity={onUpdateQuantity}
              onRequestRemove={onRequestRemove}
            />
          )
        })}
      </ul>

      {shopHasUnavailable && (
        <p className='mt-3 flex items-center gap-1.5 text-xs text-error'>
          <AlertTriangle size={14} aria-hidden='true' />
          {m.cart_shop_checkout_disabled()}
        </p>
      )}
    </section>
  )
}

interface CartItemRowProps {
  item: CartItemDetail
  shopSlug: string | null
  status: 'idle' | 'updating' | 'removing' | 'update-error' | 'remove-error'
  onUpdateQuantity: (productId: string, quantity: number) => Promise<void>
  onRequestRemove: (item: CartItemDetail) => void
}

function CartItemRow({
  item,
  shopSlug,
  status,
  onUpdateQuantity,
  onRequestRemove,
}: CartItemRowProps) {
  const product = item.product
  const isUpdating = status === 'updating'
  const isRemoving = status === 'removing'
  const hasUpdateError = status === 'update-error'
  const hasRemoveError = status === 'remove-error'

  return (
    <li className='flex gap-4 py-4 first:pt-0 last:pb-0'>
      {/* Product image */}
      <div className='flex size-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-inset sm:h-24 sm:w-24'>
        {product?.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className={`h-full w-full object-cover ${item.unavailable ? 'opacity-50 grayscale' : ''}`}
            loading='lazy'
          />
        ) : (
          <div
            className={`flex flex-col items-center justify-center text-text-muted ${item.unavailable ? 'opacity-50' : ''}`}
          >
            <ImageOff size={24} strokeWidth={1.5} aria-hidden='true' />
            <span className='sr-only'>{m.product_no_image()}</span>
          </div>
        )}
      </div>

      {/* Product details */}
      <div className='flex flex-1 flex-col gap-1'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            {item.unavailable || !product ? (
              <p className='text-sm font-medium text-text-secondary line-through'>
                {m.cart_item_unavailable()}
              </p>
            ) : (
              <Link
                to='/shops/$shopSlug/products/$productSlug'
                params={{ shopSlug: shopSlug ?? 'unknown', productSlug: product.slug }}
                className='text-sm font-semibold text-text-primary no-underline transition-colors hover:text-accent-primary'
              >
                {product.name}
              </Link>
            )}

            {product && !item.unavailable && (
              <p className='mt-0.5 text-sm font-medium text-text-primary'>
                {formatPriceEUR(product.priceCents)}
              </p>
            )}
          </div>

          {/* Remove button */}
          <button
            type='button'
            onClick={() => onRequestRemove(item)}
            disabled={isRemoving}
            className='flex-shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-error-subtle hover:text-error disabled:opacity-50'
            aria-label={m.cart_item_remove()}
          >
            {isRemoving ? (
              <Loader2 size={16} className='animate-spin' aria-hidden='true' />
            ) : (
              <Trash2 size={16} aria-hidden='true' />
            )}
          </button>
        </div>

        {/* Badges */}
        <div className='flex flex-wrap items-center gap-2'>
          {item.unavailable && (
            <Badge variant='error'>
              <PackageX size={12} className='mr-1' aria-hidden='true' />
              {m.cart_item_unavailable()}
            </Badge>
          )}
          {item.stockWarning && product && (
            <Badge variant='warning'>
              <AlertTriangle size={12} className='mr-1' aria-hidden='true' />
              {m.cart_item_stock_warning({ count: String(product.stockCount) })}
            </Badge>
          )}
        </div>

        {/* Quantity controls */}
        {!item.unavailable && product && (
          <div className='mt-1 flex flex-col gap-1.5'>
            <div className='flex items-center gap-3'>
              <span className='text-xs text-text-secondary'>{m.cart_quantity_label()}</span>
              <div className='inline-flex items-center rounded-lg border border-border-default bg-surface-default'>
                <button
                  type='button'
                  aria-label={m.product_decrease_quantity()}
                  className='px-2.5 py-1.5 text-text-primary transition hover:bg-bg-inset disabled:opacity-40'
                  disabled={isUpdating || item.quantity <= 1}
                  onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                >
                  <Minus size={14} aria-hidden='true' />
                </button>
                <span
                  className='w-10 text-center text-sm font-medium text-text-primary'
                  aria-live='polite'
                  aria-busy={isUpdating}
                >
                  {item.quantity}
                </span>
                <button
                  type='button'
                  aria-label={m.product_increase_quantity()}
                  className='px-2.5 py-1.5 text-text-primary transition hover:bg-bg-inset disabled:opacity-40'
                  disabled={isUpdating || item.quantity >= product.stockCount}
                  onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                >
                  <Plus size={14} aria-hidden='true' />
                </button>
              </div>
            </div>
            {item.quantity >= product.stockCount && (
              <p className='text-xs text-text-secondary'>{m.cart_item_stock_limit_reached()}</p>
            )}
          </div>
        )}

        {/* Errors */}
        {hasUpdateError && <p className='text-xs text-error'>{m.cart_error_updating()}</p>}
        {hasRemoveError && <p className='text-xs text-error'>{m.cart_error_removing()}</p>}
      </div>
    </li>
  )
}
