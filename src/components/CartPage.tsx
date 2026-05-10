import { Link } from '@tanstack/react-router'
import { AlertTriangle, ImageOff, Loader2, Minus, PackageX, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useCart } from '#/components/CartProvider'
import { removeCartItem, updateCartItem } from '#/lib/cart'
import { formatPriceEUR } from '#/lib/pricing'
import type { CartDetail, CartItemDetail, CartShopGroup } from '#/lib/cart.server'
import { m } from '#/paraglide/messages'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from './ui/primitives/dialog'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

export interface CartPageProps {
  cart: CartDetail | null
}

export default function CartPage({ cart: initialCart }: CartPageProps) {
  const { cart: liveCart, refreshCart } = useCart()
  const cart = liveCart ?? initialCart

  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<CartItemDetail | null>(null)
  const [updateErrorItemId, setUpdateErrorItemId] = useState<string | null>(null)
  const [removeErrorItemId, setRemoveErrorItemId] = useState<string | null>(null)

  const hasUnavailableItems = cart?.shops.some((shop) =>
    shop.items.some((item) => item.unavailable),
  ) ?? false

  const handleUpdateQuantity = async (productId: string, quantity: number) => {
    setUpdateErrorItemId(null)
    setUpdatingItemId(productId)
    try {
      await updateCartItem({ data: { productId, quantity } })
      await refreshCart()
    } catch {
      setUpdateErrorItemId(productId)
    } finally {
      setUpdatingItemId(null)
    }
  }

  const handleRemove = async (productId: string) => {
    setRemoveErrorItemId(null)
    setRemovingItemId(productId)
    try {
      await removeCartItem({ data: { productId } })
      await refreshCart()
    } catch {
      setRemoveErrorItemId(productId)
    } finally {
      setRemovingItemId(null)
      setConfirmRemoveItem(null)
    }
  }

  if (!cart || cart.shops.length === 0) {
    return <EmptyCart />
  }

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mb-8'>
        <h1 className='display-title text-3xl font-bold text-text-primary sm:text-4xl'>
          {m.cart_title()}
        </h1>
        <p className='mt-1 text-sm text-text-secondary'>
          {cart.totalItems === 1
            ? m.cart_item_single()
            : m.cart_items_count({ count: String(cart.totalItems) })}
        </p>
      </div>

      <div className='grid gap-8 lg:grid-cols-[1fr_360px]'>
        {/* Cart items */}
        <div className='space-y-6'>
          {cart.shops.map((shop) => (
            <ShopGroup
              key={shop.shopId ?? 'unavailable'}
              shop={shop}
              updatingItemId={updatingItemId}
              removingItemId={removingItemId}
              updateErrorItemId={updateErrorItemId}
              removeErrorItemId={removeErrorItemId}
              onUpdateQuantity={handleUpdateQuantity}
              onRequestRemove={setConfirmRemoveItem}
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

            <Button
              size='lg'
              className='mt-6 w-full'
              disabled={hasUnavailableItems}
              title={hasUnavailableItems ? m.cart_checkout_disabled_unavailable() : undefined}
            >
              {m.cart_proceed_to_checkout()}
            </Button>

            {hasUnavailableItems && (
              <p className='mt-2 flex items-center gap-1.5 text-xs text-error'>
                <AlertTriangle size={14} aria-hidden='true' />
                {m.cart_checkout_disabled_unavailable()}
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Remove confirmation dialog */}
      <Dialog open={confirmRemoveItem !== null} onOpenChange={() => setConfirmRemoveItem(null)}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup>
            <DialogTitle>{m.cart_item_remove_confirm_title()}</DialogTitle>
            <DialogDescription>
              {m.cart_item_remove_confirm_description()}
            </DialogDescription>
            <div className='mt-6 flex justify-end gap-3'>
              <Button variant='secondary' onClick={() => setConfirmRemoveItem(null)}>
                {m.cart_item_remove_cancel_button()}
              </Button>
              <Button
                variant='danger'
                onClick={() => {
                  if (confirmRemoveItem) {
                    void handleRemove(confirmRemoveItem.productId)
                  }
                }}
                isLoading={removingItemId === confirmRemoveItem?.productId}
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

function EmptyCart() {
  return (
    <main className='page-wrap px-4 py-20 text-center'>
      <div className='mx-auto max-w-md'>
        <div className='mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-surface-inset text-text-muted'>
          <ShoppingBag size={28} aria-hidden='true' />
        </div>
        <h1 className='display-title mb-2 text-2xl font-bold text-text-primary'>
          {m.cart_empty_title()}
        </h1>
        <p className='mb-8 text-text-secondary'>{m.cart_empty_description()}</p>
        <Link to='/category/all' className='no-underline'>
          <Button size='lg'>{m.cart_empty_browse()}</Button>
        </Link>
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
          {shopHasUnavailable && (
            <Badge variant='error'>{m.cart_item_unavailable()}</Badge>
          )}
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
        {shop.items.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            isUpdating={updatingItemId === item.productId}
            isRemoving={removingItemId === item.productId}
            hasUpdateError={updateErrorItemId === item.productId}
            hasRemoveError={removeErrorItemId === item.productId}
            onUpdateQuantity={onUpdateQuantity}
            onRequestRemove={onRequestRemove}
          />
        ))}
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
  isUpdating: boolean
  isRemoving: boolean
  hasUpdateError: boolean
  hasRemoveError: boolean
  onUpdateQuantity: (productId: string, quantity: number) => Promise<void>
  onRequestRemove: (item: CartItemDetail) => void
}

function CartItemRow({
  item,
  isUpdating,
  isRemoving,
  hasUpdateError,
  hasRemoveError,
  onUpdateQuantity,
  onRequestRemove,
}: CartItemRowProps) {
  const product = item.product

  return (
    <li className='flex gap-4 py-4 first:pt-0 last:pb-0'>
      {/* Product image */}
      <div className='flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-inset sm:h-24 sm:w-24'>
        {product?.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className={`h-full w-full object-cover ${item.unavailable ? 'opacity-50 grayscale' : ''}`}
            loading='lazy'
          />
        ) : (
          <div className={`flex flex-col items-center justify-center text-text-muted ${item.unavailable ? 'opacity-50' : ''}`}>
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
                to='/products/$productSlug'
                params={{ productSlug: product.slug }}
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
          <div className='mt-1 flex items-center gap-3'>
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
              >
                {isUpdating ? (
                  <Loader2 size={14} className='mx-auto animate-spin' aria-hidden='true' />
                ) : (
                  item.quantity
                )}
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
        )}

        {/* Errors */}
        {hasUpdateError && (
          <p className='text-xs text-error'>{m.cart_error_updating()}</p>
        )}
        {hasRemoveError && (
          <p className='text-xs text-error'>{m.cart_error_removing()}</p>
        )}
      </div>
    </li>
  )
}
