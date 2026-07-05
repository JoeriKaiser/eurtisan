import { Link } from '@tanstack/react-router'
import {
  ImageOff,
  Loader2,
  Minus,
  PackageCheck,
  PackageX,
  Plus,
  ShoppingCart,
  Store,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useCart } from '#/components/CartProvider'
import ProductReviews from '#/components/ProductReviews'
import { useAddToCart } from '#/lib/cart-hooks'
import { formatPriceEUR } from '#/lib/pricing'
import type { ProductDetail as ProductDetailType } from '#/lib/products.server'
import { ResponsiveImage } from '#/lib/responsive-image'
import { m } from '#/paraglide/messages'

export interface ProductDetailProps {
  product: ProductDetailType
}

type AddStatus = 'idle' | 'success' | 'error' | 'capped'

export default function ProductDetail({ product }: ProductDetailProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [addStatus, setAddStatus] = useState<AddStatus>('idle')
  const { cart } = useCart()
  const addToCartMutation = useAddToCart()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isOutOfStock = product.stockCount <= 0
  const images = product.images ?? []
  const selectedImage = images[selectedImageIndex]

  const handleAddToCart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isOutOfStock || isAdding) return

    setIsAdding(true)
    setAddStatus('idle')

    let result: Awaited<ReturnType<typeof addToCartMutation.mutateAsync>> | null = null

    try {
      const existingQty =
        cart?.shops.flatMap((s) => s.items).find((i) => i.productId === product.id)?.quantity ?? 0

      result = await addToCartMutation.mutateAsync({
        productId: product.id,
        quantity,
      })

      if (result === null) {
        setAddStatus('error')
      } else if (result.quantity < existingQty + quantity) {
        setAddStatus('capped')
      } else {
        setAddStatus('success')
      }
    } catch {
      setAddStatus('error')
    } finally {
      setIsAdding(false)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => setAddStatus('idle'), 3000)
    }
  }

  return (
    <main className='page-wrap px-4 pb-8 pt-14'>
      <div className='grid gap-6 lg:grid-cols-[1fr_380px]'>
        {/* Left column: images */}
        <div>
          {/* Main image */}
          <div className='island-shell relative aspect-[4/3] w-full overflow-hidden rounded-2xl'>
            {selectedImage ? (
              <ResponsiveImage
                src={selectedImage.url}
                alt={selectedImage.altText ?? product.name}
                loading='eager'
                sizes='(max-width: 768px) 100vw, 60vw'
                className='h-full w-full'
                imgClassName='h-full w-full object-cover'
              />
            ) : (
              <div className='flex h-full w-full flex-col items-center justify-center gap-2 text-text-secondary'>
                <ImageOff size={48} strokeWidth={1.5} aria-hidden='true' />
                <span className='text-sm'>{m.product_no_image()}</span>
              </div>
            )}

            {isOutOfStock && (
              <div className='absolute inset-0 flex items-center justify-center bg-scrim-image-subtle backdrop-blur-[1px]'>
                <span className='rounded-full bg-surface-default px-4 py-2 text-sm font-semibold text-text-primary shadow-sm'>
                  <PackageX
                    size={16}
                    className='inline align-text-bottom mr-1'
                    aria-hidden='true'
                  />
                  {m.product_out_of_stock()}
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div
              className='mt-4 flex gap-2 overflow-x-auto pb-1'
              role='tablist'
              aria-label={m.product_gallery_label()}
            >
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type='button'
                  role='tab'
                  aria-selected={index === selectedImageIndex}
                  aria-label={m.product_gallery_image({
                    index: String(index + 1),
                    total: String(images.length),
                  })}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`relative size-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    index === selectedImageIndex
                      ? 'border-accent-secondary'
                      : 'border-transparent hover:border-border-strong'
                  }`}
                >
                  <ResponsiveImage
                    src={image.url}
                    alt={image.altText ?? ''}
                    loading='lazy'
                    sizes='80px'
                    placeholder='none'
                    className='h-full w-full'
                    imgClassName='h-full w-full object-cover'
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right column: product info */}
        <div className='space-y-6'>
          <section className='island-shell rounded-2xl p-6 sm:p-8'>
            <p className='island-kicker mb-2'>
              {product.categoryName ?? m.product_uncategorized()}
            </p>
            <h1 className='display-title mb-3 text-3xl font-semibold text-text-primary sm:text-4xl'>
              {product.name}
            </h1>

            <p className='mb-1 text-2xl font-bold text-text-primary'>
              {formatPriceEUR(product.priceCents)}
            </p>
            <p className='mb-2 text-xs text-text-muted'>
              {product.shopIsVatRegistered ? m.vat_included() : m.vat_exempt_short()}
            </p>

            <div className='mb-4 flex items-center gap-2 text-sm text-text-secondary'>
              {isOutOfStock ? (
                <span className='inline-flex items-center gap-1 text-red-600 dark:text-red-400'>
                  <PackageX size={14} aria-hidden='true' />
                  {m.product_out_of_stock()}
                </span>
              ) : (
                <span className='inline-flex items-center gap-1 text-success'>
                  <PackageCheck size={14} aria-hidden='true' />
                  {m.product_in_stock({ count: product.stockCount })}
                </span>
              )}
            </div>

            {product.description && (
              <p className='mb-6 whitespace-pre-wrap text-base text-text-secondary leading-relaxed'>
                {product.description}
              </p>
            )}

            {/* Add to cart form */}
            <form className='space-y-4' onSubmit={handleAddToCart}>
              <div className='flex items-center gap-3'>
                <label htmlFor='quantity' className='text-sm font-medium text-text-primary'>
                  {m.product_quantity()}
                </label>
                <div className='inline-flex items-center rounded-lg border border-border-default bg-surface-default'>
                  <button
                    type='button'
                    aria-label={m.product_decrease_quantity()}
                    className='px-3 py-2 text-text-primary transition hover:bg-bg-inset disabled:opacity-40'
                    disabled={quantity <= 1 || isOutOfStock || isAdding}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus size={14} aria-hidden='true' />
                  </button>
                  <input
                    type='number'
                    id='quantity'
                    min={1}
                    max={product.stockCount}
                    value={quantity}
                    disabled={isOutOfStock || isAdding}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10)
                      if (Number.isNaN(value)) {
                        setQuantity(1)
                        return
                      }
                      setQuantity(Math.max(1, Math.min(product.stockCount, value)))
                    }}
                    className='w-10 border-0 bg-transparent p-0 text-center text-sm font-medium text-text-primary focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                    aria-live='polite'
                    aria-label={m.product_quantity()}
                  />
                  <button
                    type='button'
                    aria-label={m.product_increase_quantity()}
                    className='px-3 py-2 text-text-primary transition hover:bg-bg-inset disabled:opacity-40'
                    disabled={quantity >= product.stockCount || isOutOfStock || isAdding}
                    onClick={() => setQuantity((q) => Math.min(product.stockCount, q + 1))}
                  >
                    <Plus size={14} aria-hidden='true' />
                  </button>
                </div>
              </div>

              <button
                type='submit'
                disabled={isOutOfStock || isAdding}
                className='inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-primary px-5 py-3 text-sm font-semibold text-text-on-primary shadow-sm transition hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50'
              >
                {isAdding ? (
                  <>
                    <Loader2 size={16} className='animate-spin' aria-hidden='true' />
                    {m.cart_add_loading()}
                  </>
                ) : (
                  <>
                    <ShoppingCart size={16} aria-hidden='true' />
                    {isOutOfStock ? m.product_out_of_stock() : m.product_add_to_cart()}
                  </>
                )}
              </button>

              <div className='min-h-5' aria-live='polite' aria-atomic='true'>
                {addStatus === 'success' && (
                  <p className='text-sm font-medium text-success'>{m.cart_add_success()}</p>
                )}
                {addStatus === 'capped' && (
                  <p className='text-sm font-medium text-success'>{m.cart_add_stock_limit()}</p>
                )}
                {addStatus === 'error' && (
                  <p className='text-sm font-medium text-red-600 dark:text-red-400'>
                    {m.cart_add_error()}
                  </p>
                )}
              </div>
            </form>
          </section>

          {/* Shop card */}
          <section className='island-shell rounded-2xl p-6'>
            <h2 className='mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary'>
              {m.product_sold_by()}
            </h2>
            <div className='flex items-start gap-3'>
              <div className='flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-inset'>
                <Store size={18} className='text-text-secondary' aria-hidden='true' />
              </div>
              <div className='min-w-0'>
                <p className='text-base font-semibold text-text-primary'>
                  {product.shopName ?? m.product_unknown_shop()}
                </p>
                {product.shopDescription && (
                  <p className='mt-1 text-sm text-text-secondary line-clamp-2'>
                    {product.shopDescription}
                  </p>
                )}
                {product.shopSlug && (
                  <Link
                    to='/shops/$shopSlug'
                    params={{ shopSlug: product.shopSlug }}
                    className='mt-2 inline-block text-sm font-medium text-text-secondary no-underline hover:text-text-primary hover:underline transition-colors'
                  >
                    {m.product_visit_shop()}
                  </Link>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Reviews */}
      <div className='mt-8'>
        <ProductReviews productId={product.id} />
      </div>
    </main>
  )
}
