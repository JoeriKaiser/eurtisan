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
import { useEffect, useRef, useState } from 'react'
import { useCart } from '#/components/CartProvider'
import ProductReviews from '#/components/ProductReviews'
import { addToCart } from '#/lib/cart'
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
  const { cart, refreshCart } = useCart()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const isOutOfStock = product.stockCount <= 0
  const selectedImage = product.images[selectedImageIndex]

  const handleAddToCart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isOutOfStock || isAdding) return

    setIsAdding(true)
    setAddStatus('idle')

    let result: Awaited<ReturnType<typeof addToCart>> | null = null

    try {
      const existingQty =
        cart?.shops.flatMap((s) => s.items).find((i) => i.productId === product.id)?.quantity ?? 0

      result = await addToCart({
        data: { productId: product.id, quantity },
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
    }

    try {
      await refreshCart()
    } catch {
      // Refresh failure should not mask a successful add
      if (result !== null && addStatus !== 'error') {
        // keep current success/capped status
      }
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
              <div
                className='flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--sea-ink-soft)]'
                role='img'
                aria-label={m.product_no_image()}
              >
                <ImageOff size={48} strokeWidth={1.5} aria-hidden='true' />
                <span className='text-sm'>{m.product_no_image()}</span>
              </div>
            )}

            {isOutOfStock && (
              <div className='absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]'>
                <span
                  className='rounded-full bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] shadow-sm'
                  role='status'
                >
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
          {product.images.length > 1 && (
            <div
              className='mt-4 flex gap-2 overflow-x-auto pb-1'
              role='tablist'
              aria-label={m.product_gallery_label()}
            >
              {product.images.map((image, index) => (
                <button
                  key={image.id}
                  type='button'
                  role='tab'
                  aria-selected={index === selectedImageIndex}
                  aria-label={m.product_gallery_image({
                    index: String(index + 1),
                    total: String(product.images.length),
                  })}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    index === selectedImageIndex
                      ? 'border-[var(--lagoon)]'
                      : 'border-transparent hover:border-[var(--line)]'
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
            <h1 className='display-title mb-3 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl'>
              {product.name}
            </h1>

            <p className='mb-1 text-2xl font-bold text-[var(--sea-ink)]'>
              {formatPriceEUR(product.priceCents)}
            </p>

            <div className='mb-4 flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]'>
              {isOutOfStock ? (
                <span className='inline-flex items-center gap-1 text-red-600 dark:text-red-400'>
                  <PackageX size={14} aria-hidden='true' />
                  {m.product_out_of_stock()}
                </span>
              ) : (
                <span className='inline-flex items-center gap-1 text-[var(--palm)]'>
                  <PackageCheck size={14} aria-hidden='true' />
                  {m.product_in_stock({ count: product.stockCount })}
                </span>
              )}
            </div>

            {product.description && (
              <p className='mb-6 whitespace-pre-wrap text-base text-[var(--sea-ink-soft)] leading-relaxed'>
                {product.description}
              </p>
            )}

            {/* Add to cart form */}
            <form className='space-y-4' onSubmit={handleAddToCart}>
              <div className='flex items-center gap-3'>
                <label htmlFor='quantity' className='text-sm font-medium text-[var(--sea-ink)]'>
                  {m.product_quantity()}
                </label>
                <div className='inline-flex items-center rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)]'>
                  <button
                    type='button'
                    aria-label={m.product_decrease_quantity()}
                    className='px-3 py-2 text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-40'
                    disabled={quantity <= 1 || isOutOfStock || isAdding}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus size={14} aria-hidden='true' />
                  </button>
                  <input
                    type='text'
                    id='quantity'
                    readOnly
                    value={quantity}
                    className='w-10 border-0 bg-transparent p-0 text-center text-sm font-medium text-[var(--sea-ink)] focus:outline-none focus:ring-0'
                    aria-live='polite'
                  />
                  <button
                    type='button'
                    aria-label={m.product_increase_quantity()}
                    className='px-3 py-2 text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-40'
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
                className='inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--palm)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
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

              {addStatus === 'success' && (
                <p className='text-sm font-medium text-[var(--palm)]'>{m.cart_add_success()}</p>
              )}
              {addStatus === 'capped' && (
                <p className='text-sm font-medium text-[var(--palm)]'>{m.cart_add_stock_limit()}</p>
              )}
              {addStatus === 'error' && (
                <p className='text-sm font-medium text-red-600 dark:text-red-400'>
                  {m.cart_add_error()}
                </p>
              )}
            </form>
          </section>

          {/* Shop card */}
          <section className='island-shell rounded-2xl p-6'>
            <h2 className='mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]'>
              {m.product_sold_by()}
            </h2>
            <div className='flex items-start gap-3'>
              <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--sand)]'>
                <Store size={18} className='text-[var(--sea-ink-soft)]' aria-hidden='true' />
              </div>
              <div className='min-w-0'>
                <p className='text-base font-semibold text-[var(--sea-ink)]'>
                  {product.shopName ?? m.product_unknown_shop()}
                </p>
                {product.shopDescription && (
                  <p className='mt-1 text-sm text-[var(--sea-ink-soft)] line-clamp-2'>
                    {product.shopDescription}
                  </p>
                )}
                {/* Public shop page route does not yet exist */}
                {product.shopSlug && (
                  <span className='mt-2 inline-block text-sm text-[var(--sea-ink-soft)]'>
                    {m.product_visit_shop()}
                  </span>
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
