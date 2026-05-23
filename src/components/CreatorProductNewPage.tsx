import { useRouter } from '@tanstack/react-router'
import { Check, ImageIcon, Plus, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CreatorShop } from '#/lib/creator-dashboard'
import { createProduct } from '#/lib/creator-products'
import { m } from '#/paraglide/messages'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Skeleton } from './ui/skeleton'
import { Switch } from './ui/switch'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface CreatorProductNewPageProps {
  shops: CreatorShop[]
  categories: Array<{ id: string; name: string; slug: string }>
}

interface FeedbackState {
  type: 'success' | 'error'
  message: string
}

interface ImageFileEntry {
  id: string
  file: File
  dataUrl: string
  altText: string
  reading: boolean
  error: string | null
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGES = 10
const SLUG_DEBOUNCE_MS = 400

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function CreatorProductNewPage({ shops, categories }: CreatorProductNewPageProps) {
  if (shops.length === 0) {
    return <NoShopState />
  }

  return <ProductNewForm shops={shops} categories={categories} />
}

/* -------------------------------------------------------------------------- */
/*                                Product Form                                */
/* -------------------------------------------------------------------------- */

function ProductNewForm({
  shops,
  categories,
}: {
  shops: CreatorShop[]
  categories: Array<{ id: string; name: string; slug: string }>
}) {
  const router = useRouter()

  // Form state
  const [shopId, setShopId] = useState(shops[0].id)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stockCount, setStockCount] = useState('0')
  const [categoryId, setCategoryId] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Image state
  const [images, setImages] = useState<ImageFileEntry[]>([])

  // Slug validation
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Field-level errors from client validation or server
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Form submission
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)

  // Cancel confirmation
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const hasChanges =
    name !== '' ||
    description !== '' ||
    price !== '' ||
    stockCount !== '0' ||
    categoryId !== '' ||
    images.length > 0

  /* ------------------------ Slug auto-generation --------------------------- */

  function generateSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugManuallyEdited) {
      const autoSlug = generateSlug(value)
      setSlug(autoSlug)
    }
  }

  const handleSlugChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/\s+/g, '-')
    setSlug(cleaned)
    setSlugManuallyEdited(true)
  }

  // Debounced slug format validation
  useEffect(() => {
    if (slugTimerRef.current) {
      clearTimeout(slugTimerRef.current)
    }

    if (!slug) {
      setSlugError(null)
      return
    }

    slugTimerRef.current = setTimeout(() => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        setSlugError(m.creator_product_new_slug_format_error())
      } else {
        setSlugError(null)
      }
    }, SLUG_DEBOUNCE_MS)

    return () => {
      if (slugTimerRef.current) {
        clearTimeout(slugTimerRef.current)
      }
    }
  }, [slug])

  /* ---------------------------- Image handling ----------------------------- */

  const readFileAsDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (reader.result) {
          resolve(reader.result as string)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }, [])

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      setFieldErrors((prev) => ({ ...prev, images: m.creator_product_new_images_error_max() }))
      return
    }

    const filesToAdd = Array.from(files).slice(0, remaining)

    // Create placeholder entries with reading state
    const placeholders: ImageFileEntry[] = filesToAdd.map((file) => ({
      id: crypto.randomUUID(),
      file,
      dataUrl: '',
      altText: '',
      reading: true,
      error: null,
    }))

    setImages((prev) => [...prev, ...placeholders])
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.images
      return next
    })

    // Read each file asynchronously
    for (const placeholder of placeholders) {
      // Client-side validation
      if (!ALLOWED_IMAGE_TYPES.includes(placeholder.file.type)) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === placeholder.id
              ? { ...img, reading: false, error: m.creator_product_new_images_error_type() }
              : img,
          ),
        )
        continue
      }

      if (placeholder.file.size > MAX_IMAGE_SIZE) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === placeholder.id
              ? { ...img, reading: false, error: m.creator_product_new_images_error_size() }
              : img,
          ),
        )
        continue
      }

      try {
        const dataUrl = await readFileAsDataUrl(placeholder.file)
        setImages((prev) =>
          prev.map((img) =>
            img.id === placeholder.id ? { ...img, dataUrl, reading: false } : img,
          ),
        )
      } catch {
        setImages((prev) =>
          prev.map((img) =>
            img.id === placeholder.id
              ? { ...img, reading: false, error: m.creator_product_new_images_error_type() }
              : img,
          ),
        )
      }
    }

    // Reset the file input
    const input = document.getElementById('product-image-upload') as HTMLInputElement
    if (input) input.value = ''
  }

  const handleRemoveImage = (imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId))
  }

  /* ---------------------------- Form validation ---------------------------- */

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {}

    if (!name.trim()) {
      errors.name = m.creator_product_new_name_required()
    }

    if (!slug.trim()) {
      errors.slug = m.creator_product_new_slug_required()
    } else if (slugError) {
      errors.slug = slugError
    }

    if (description.length > 2000) {
      errors.description = m.creator_product_new_description_too_long()
    }

    const priceNum = Number.parseFloat(price)
    if (!price || Number.isNaN(priceNum)) {
      errors.price = m.creator_product_new_price_required()
    } else if (priceNum <= 0) {
      errors.price = m.creator_product_new_price_positive()
    }

    const stockNum = Number.parseInt(stockCount, 10)
    if (Number.isNaN(stockNum) || stockNum < 0) {
      errors.stock = m.creator_product_new_stock_negative()
    }

    const erroredImages = images.filter((img) => img.error)
    if (erroredImages.length > 0) {
      errors.images = m.creator_product_new_images_error_type()
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [name, slug, slugError, description, price, stockCount, images])

  /* ---------------------------- Form submission ---------------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    if (!validateForm()) return

    setSubmitting(true)

    try {
      const priceCents = Math.round(Number.parseFloat(price) * 100)

      await createProduct({
        data: {
          shopId,
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          priceCents,
          stockCount: Number.parseInt(stockCount, 10) || 0,
          categoryId: categoryId || undefined,
          isActive,
          images: images
            .filter((img) => !img.error && img.dataUrl)
            .map((img) => ({
              dataUrl: img.dataUrl,
              altText: img.altText || undefined,
            })),
        },
      })

      setFeedback({ type: 'success', message: m.creator_product_new_save_success() })

      // Redirect to products list after brief delay to show success
      setTimeout(() => {
        router.navigate({ to: '/creator/products' })
      }, 800)
    } catch (err) {
      // Handle server errors
      if (err instanceof Error) {
        if (err.message === 'DUPLICATE_SLUG') {
          setFieldErrors((prev) => ({
            ...prev,
            slug: m.creator_product_new_slug_duplicate(),
          }))
        } else if (err.message === 'Invalid category_id') {
          setFieldErrors((prev) => ({
            ...prev,
            categoryId: m.creator_product_new_category_invalid(),
          }))
        } else if (
          err.message.includes('Invalid') ||
          err.message.includes('image') ||
          err.message.includes('Image')
        ) {
          setFieldErrors((prev) => ({
            ...prev,
            images: err.message,
          }))
        } else {
          setFeedback({ type: 'error', message: m.creator_product_new_save_error() })
        }
      } else {
        setFeedback({ type: 'error', message: m.creator_product_new_save_error() })
      }
    } finally {
      setSubmitting(false)
    }
  }

  /* ---------------------------- Cancel handling ---------------------------- */

  const handleCancel = () => {
    if (hasChanges) {
      setShowCancelConfirm(true)
    } else {
      router.navigate({ to: '/creator/products' })
    }
  }

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false)
    router.navigate({ to: '/creator/products' })
  }

  const handleDismissCancel = () => {
    setShowCancelConfirm(false)
  }

  /* ------------------------------ Render ----------------------------------- */

  return (
    <main className='page-wrap px-4 py-8 sm:py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='display-title mb-2 text-3xl font-bold text-text-primary'>
            {m.creator_product_new_title()}
          </h1>
          <p className='text-text-secondary'>{m.creator_product_new_description()}</p>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`mb-6 rounded-lg border p-4 text-sm ${
              feedback.type === 'success'
                ? 'border-success bg-success-subtle text-success'
                : 'border-error bg-error-subtle text-error'
            }`}
            role='alert'
          >
            <div className='flex items-center gap-2'>
              {feedback.type === 'success' ? (
                <Check size={18} aria-hidden='true' />
              ) : (
                <X size={18} aria-hidden='true' />
              )}
              <span>{feedback.message}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className='grid gap-8 lg:grid-cols-3'>
            {/* Left column: text fields */}
            <div className='space-y-5 lg:col-span-2'>
              {/* Shop selector */}
              {shops.length > 1 && (
                <div>
                  <label
                    htmlFor='product-shop'
                    className='mb-2 block text-sm font-medium text-text-primary'
                  >
                    {m.creator_product_new_shop_label()}
                  </label>
                  <select
                    id='product-shop'
                    value={shopId}
                    onChange={(e) => setShopId(e.target.value)}
                    className='flex h-10 w-full max-w-xs rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Product name */}
              <div>
                <label
                  htmlFor='product-name'
                  className='mb-2 block text-sm font-medium text-text-primary'
                >
                  {m.creator_product_new_name_label()}
                </label>
                <Input
                  id='product-name'
                  type='text'
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  error={fieldErrors.name}
                  placeholder={m.creator_product_new_name_placeholder()}
                  maxLength={100}
                  required
                />
                {fieldErrors.name && (
                  <p id='product-name-error' className='mt-1 text-sm text-error'>
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              {/* Slug */}
              <div>
                <label
                  htmlFor='product-slug'
                  className='mb-2 block text-sm font-medium text-text-primary'
                >
                  {m.creator_product_new_slug_label()}
                </label>
                <div className='relative'>
                  <Input
                    id='product-slug'
                    type='text'
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    error={fieldErrors.slug || slugError || undefined}
                    placeholder={m.creator_product_new_slug_placeholder()}
                    maxLength={100}
                    required
                  />
                  {slug && !slugError && !fieldErrors.slug && (
                    <span className='absolute right-3 top-1/2 -translate-y-1/2 text-success'>
                      <Check size={16} aria-hidden='true' />
                    </span>
                  )}
                </div>
                {(fieldErrors.slug || slugError) && (
                  <p id='product-slug-error' className='mt-1 text-sm text-error'>
                    {fieldErrors.slug || slugError}
                  </p>
                )}
                {!fieldErrors.slug && !slugError && (
                  <p className='mt-1 text-xs text-text-muted'>
                    {m.creator_product_new_slug_hint()}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor='product-description'
                  className='mb-2 block text-sm font-medium text-text-primary'
                >
                  {m.creator_product_new_description_label()}
                </label>
                <textarea
                  id='product-description'
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={m.creator_product_new_description_placeholder()}
                  className={`w-full rounded-lg border bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 resize-y ${
                    fieldErrors.description
                      ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
                      : 'border-border-default hover:border-border-strong focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20'
                  }`}
                  maxLength={2000}
                />
                <div className='mt-1 flex items-center justify-between'>
                  {fieldErrors.description && (
                    <p id='product-description-error' className='text-sm text-error'>
                      {fieldErrors.description}
                    </p>
                  )}
                  <p className='text-xs text-text-muted ml-auto'>{description.length}/2000</p>
                </div>
              </div>

              {/* Price + Stock row */}
              <div className='grid gap-5 sm:grid-cols-2'>
                {/* Price */}
                <div>
                  <label
                    htmlFor='product-price'
                    className='mb-2 block text-sm font-medium text-text-primary'
                  >
                    {m.creator_product_new_price_label()}
                  </label>
                  <div className='relative'>
                    <span className='absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted'>
                      €
                    </span>
                    <Input
                      id='product-price'
                      type='number'
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      error={fieldErrors.price}
                      placeholder={m.creator_product_new_price_placeholder()}
                      min='0'
                      step='0.01'
                      className='pl-7'
                      required
                    />
                  </div>
                  {fieldErrors.price && (
                    <p id='product-price-error' className='mt-1 text-sm text-error'>
                      {fieldErrors.price}
                    </p>
                  )}
                </div>

                {/* Stock */}
                <div>
                  <label
                    htmlFor='product-stock'
                    className='mb-2 block text-sm font-medium text-text-primary'
                  >
                    {m.creator_product_new_stock_label()}
                  </label>
                  <Input
                    id='product-stock'
                    type='number'
                    value={stockCount}
                    onChange={(e) => setStockCount(e.target.value)}
                    error={fieldErrors.stock}
                    placeholder={m.creator_product_new_stock_placeholder()}
                    min='0'
                    step='1'
                    required
                  />
                  {fieldErrors.stock && (
                    <p id='product-stock-error' className='mt-1 text-sm text-error'>
                      {fieldErrors.stock}
                    </p>
                  )}
                </div>
              </div>

              {/* Category selector */}
              <div>
                <label
                  htmlFor='product-category'
                  className='mb-2 block text-sm font-medium text-text-primary'
                >
                  {m.creator_product_new_category_label()}
                </label>
                <select
                  id='product-category'
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={`flex h-10 w-full rounded-lg border bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 ${
                    fieldErrors.categoryId
                      ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
                      : 'border-border-default hover:border-border-strong'
                  }`}
                >
                  <option value=''>{m.creator_product_new_category_none()}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.categoryId && (
                  <p id='product-category-error' className='mt-1 text-sm text-error'>
                    {fieldErrors.categoryId}
                  </p>
                )}
              </div>

              {/* Active toggle */}
              <div className='flex items-center gap-3'>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span className='text-sm text-text-primary'>
                  {isActive
                    ? m.creator_product_new_active_label()
                    : m.creator_product_new_inactive_label()}
                </span>
                {isActive && (
                  <span className='text-xs text-text-muted'>
                    {m.creator_product_new_active_description()}
                  </span>
                )}
              </div>
            </div>

            {/* Right column: images */}
            <div>
              <span className='mb-2 block text-sm font-medium text-text-primary'>
                {m.creator_product_new_images_label()}
              </span>
              <p className='mb-3 text-xs text-text-muted'>{m.creator_product_new_images_hint()}</p>

              {/* Image thumbnails */}
              {images.length > 0 && (
                <div className='mb-3 grid grid-cols-2 gap-2'>
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className='relative overflow-hidden rounded-lg border border-border-default'
                    >
                      {img.reading ? (
                        <div className='flex aspect-square items-center justify-center bg-surface-inset'>
                          <div className='text-center'>
                            <svg
                              className='mx-auto size-6 animate-spin text-text-muted'
                              xmlns='http://www.w3.org/2000/svg'
                              fill='none'
                              viewBox='0 0 24 24'
                              aria-label={m.creator_product_new_images_reading()}
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
                            <p className='mt-1 text-xs text-text-muted'>
                              {m.creator_product_new_images_reading()}
                            </p>
                          </div>
                        </div>
                      ) : img.error ? (
                        <div className='flex aspect-square items-center justify-center bg-error-subtle p-2 text-center'>
                          <p className='text-xs text-error'>{img.error}</p>
                        </div>
                      ) : (
                        <img
                          src={img.dataUrl}
                          alt={img.altText || ''}
                          className='aspect-square w-full object-cover'
                        />
                      )}
                      <button
                        type='button'
                        onClick={() => handleRemoveImage(img.id)}
                        className='absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-bg-overlay text-white backdrop-blur-sm transition hover:bg-error'
                        aria-label={m.creator_product_new_images_remove()}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* No images placeholder */}
              {images.length === 0 && (
                <div className='mb-3 flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border-default bg-surface-inset'>
                  <div className='text-center'>
                    <ImageIcon
                      size={32}
                      className='mx-auto mb-2 text-text-muted'
                      aria-hidden='true'
                    />
                    <p className='text-sm text-text-muted'>
                      {m.creator_product_new_images_no_images()}
                    </p>
                  </div>
                </div>
              )}

              {/* File input */}
              <div>
                <input
                  id='product-image-upload'
                  type='file'
                  accept='image/jpeg,image/png,image/webp'
                  multiple
                  onChange={handleImageSelect}
                  className='hidden'
                />
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={() => document.getElementById('product-image-upload')?.click()}
                  disabled={images.length >= MAX_IMAGES}
                  className='w-full'
                >
                  <Upload size={16} aria-hidden='true' />
                  {m.creator_product_new_images_add()}
                </Button>
                <p className='mt-1 text-xs text-text-muted text-center'>
                  {images.filter((i) => !i.error).length}/{MAX_IMAGES}
                </p>
              </div>

              {fieldErrors.images && (
                <p className='mt-2 text-sm text-error'>{fieldErrors.images}</p>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className='mt-8 flex items-center gap-4 border-t border-border-subtle pt-6'>
            <Button type='submit' variant='primary' isLoading={submitting} disabled={submitting}>
              <Plus size={16} aria-hidden='true' />
              {submitting ? m.creator_product_new_submitting() : m.creator_product_new_submit()}
            </Button>
            <Button type='button' variant='ghost' onClick={handleCancel} disabled={submitting}>
              {m.creator_product_new_cancel()}
            </Button>
          </div>
        </form>
      </section>

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
          role='dialog'
          aria-modal='true'
          aria-labelledby='cancel-dialog-title'
          aria-describedby='cancel-dialog-description'
        >
          <div className='mx-4 w-full max-w-sm rounded-xl bg-surface-default p-6 shadow-lg'>
            <h3 id='cancel-dialog-title' className='mb-2 text-lg font-semibold text-text-primary'>
              {m.creator_product_new_unsaved_title()}
            </h3>
            <p id='cancel-dialog-description' className='mb-6 text-sm text-text-secondary'>
              {m.creator_product_new_unsaved_description()}
            </p>
            <div className='flex justify-end gap-3'>
              <Button variant='secondary' onClick={handleDismissCancel}>
                {m.creator_product_new_unsaved_cancel()}
              </Button>
              <Button variant='danger' onClick={handleConfirmCancel}>
                {m.creator_product_new_unsaved_confirm()}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                               Empty States                                 */
/* -------------------------------------------------------------------------- */

function NoShopState() {
  const router = useRouter()

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='py-12 text-center'>
          <ImageIcon size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <h2 className='mb-2 text-xl font-semibold text-text-primary'>
            {m.creator_product_new_no_shops_title()}
          </h2>
          <p className='mx-auto max-w-md text-text-secondary'>
            {m.creator_product_new_no_shops_description()}
          </p>
          <div className='mt-6'>
            <Button variant='primary' onClick={() => router.navigate({ to: '/creator/shop' })}>
              {m.creator_shop_settings_title()}
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Loading / Error                                */
/* -------------------------------------------------------------------------- */

export function CreatorProductNewLoading() {
  return (
    <main className='page-wrap px-4 py-8 sm:py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-2 h-9 w-64' />
        <Skeleton className='mb-8 h-5 w-56' />

        <div className='grid gap-8 lg:grid-cols-3'>
          <div className='space-y-5 lg:col-span-2'>
            <div>
              <Skeleton className='mb-2 h-4 w-20' />
              <Skeleton className='h-10 w-full' />
            </div>
            <div>
              <Skeleton className='mb-2 h-4 w-16' />
              <Skeleton className='h-10 w-full' />
            </div>
            <div>
              <Skeleton className='mb-2 h-4 w-24' />
              <Skeleton className='h-32 w-full' />
            </div>
            <div className='grid gap-5 sm:grid-cols-2'>
              <div>
                <Skeleton className='mb-2 h-4 w-20' />
                <Skeleton className='h-10 w-full' />
              </div>
              <div>
                <Skeleton className='mb-2 h-4 w-24' />
                <Skeleton className='h-10 w-full' />
              </div>
            </div>
            <div>
              <Skeleton className='mb-2 h-4 w-20' />
              <Skeleton className='h-10 w-full' />
            </div>
          </div>
          <div>
            <Skeleton className='mb-2 h-4 w-20' />
            <Skeleton className='mb-3 aspect-square w-full rounded-lg' />
            <Skeleton className='h-8 w-full' />
          </div>
        </div>

        <div className='mt-8 border-t border-border-subtle pt-6'>
          <Skeleton className='h-10 w-40' />
        </div>
      </section>
    </main>
  )
}

export function CreatorProductNewError({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <main className='page-wrap px-4 py-8 sm:py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-bold text-text-primary'>
          {m.creator_product_new_title()}
        </h1>
        <div className='py-12 text-center'>
          <p className='text-text-secondary'>{m.creator_error_load()}</p>
          <p className='mt-2 text-sm text-text-muted'>{error.message}</p>
          <div className='mt-6'>
            <Button variant='secondary' onClick={() => void router.invalidate()}>
              {m.creator_error_retry()}
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
