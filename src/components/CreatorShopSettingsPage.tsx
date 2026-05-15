import { useRouter } from '@tanstack/react-router'
import { Check, ImageIcon, Store, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CreatorShopDetail } from '#/lib/creator-dashboard'
import { checkShopSlug, updateShop, uploadShopImage } from '#/lib/shop-settings'
import { m } from '#/paraglide/messages'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Skeleton } from './ui/skeleton'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface CreatorShopSettingsPageProps {
  shop: CreatorShopDetail | null
  allShops: Array<{ id: string; name: string }>
}

interface FeedbackState {
  type: 'success' | 'error'
  message: string
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const SLUG_DEBOUNCE_MS = 400

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function CreatorShopSettingsPage({ shop, allShops }: CreatorShopSettingsPageProps) {
  const router = useRouter()

  // No shop at all
  if (!shop && allShops.length === 0) {
    return <NoShopState />
  }

  // Shop not found (e.g., bad shopId query param)
  if (!shop) {
    return <ShopNotFoundState />
  }

  return (
    <ShopSettingsForm
      key={shop.id}
      shop={shop}
      allShops={allShops}
      onShopChanged={() => router.invalidate()}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*                              Settings Form                                 */
/* -------------------------------------------------------------------------- */

function ShopSettingsForm({
  shop,
  allShops,
  onShopChanged,
}: {
  shop: CreatorShopDetail
  allShops: Array<{ id: string; name: string }>
  onShopChanged: () => void
}) {
  const router = useRouter()

  // Form state
  const [name, setName] = useState(shop.name)
  const [slug, setSlug] = useState(shop.slug)
  const [description, setDescription] = useState(shop.description ?? '')

  // Shipping origin state
  const [originStreet, setOriginStreet] = useState(shop.shippingOrigin?.street ?? '')
  const [originCity, setOriginCity] = useState(shop.shippingOrigin?.city ?? '')
  const [originPostal, setOriginPostal] = useState(shop.shippingOrigin?.postalCode ?? '')
  const [originCountry, setOriginCountry] = useState(shop.shippingOrigin?.country ?? '')

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(shop.image ?? null)
  const [imageError, setImageError] = useState<string | null>(null)

  // Slug validation
  const [slugChecking, setSlugChecking] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCheckedSlugRef = useRef<string>(shop.slug)

  // Form submission
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)

  // Field-level errors from server
  const [nameError, setNameError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)

  const slugChanged = slug !== shop.slug
  const imageChanged = imageFile !== null
  const originChanged =
    originStreet !== (shop.shippingOrigin?.street ?? '') ||
    originCity !== (shop.shippingOrigin?.city ?? '') ||
    originPostal !== (shop.shippingOrigin?.postalCode ?? '') ||
    originCountry !== (shop.shippingOrigin?.country ?? '')
  const hasChanges =
    name !== shop.name ||
    slugChanged ||
    description !== (shop.description ?? '') ||
    imageChanged ||
    originChanged

  /* ----------------------------- Slug validation ---------------------------- */

  const checkSlug = useCallback(
    async (value: string) => {
      if (value === shop.slug) {
        setSlugError(null)
        setSlugAvailable(null)
        setSlugChecking(false)
        return
      }

      // Client-side slug format check
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
        setSlugError(m.creator_shop_slug_format_error())
        setSlugAvailable(null)
        setSlugChecking(false)
        return
      }

      setSlugChecking(true)
      setSlugError(null)

      try {
        const result = await checkShopSlug({ data: { slug: value, excludeShopId: shop.id } })
        if (result.available) {
          setSlugAvailable(true)
          setSlugError(null)
        } else {
          setSlugAvailable(false)
          setSlugError(m.creator_shop_slug_taken_error())
        }
      } catch {
        setSlugError(m.creator_shop_slug_check_error())
        setSlugAvailable(null)
      } finally {
        setSlugChecking(false)
      }
    },
    [shop.id, shop.slug],
  )

  // Debounced slug check
  useEffect(() => {
    if (slugTimerRef.current) {
      clearTimeout(slugTimerRef.current)
    }

    if (slug === lastCheckedSlugRef.current) return
    lastCheckedSlugRef.current = slug

    if (slug === shop.slug) {
      setSlugError(null)
      setSlugAvailable(null)
      setSlugChecking(false)
      return
    }

    slugTimerRef.current = setTimeout(() => {
      checkSlug(slug)
    }, SLUG_DEBOUNCE_MS)

    return () => {
      if (slugTimerRef.current) {
        clearTimeout(slugTimerRef.current)
      }
    }
  }, [slug, shop.slug, checkSlug])

  /* ---------------------------- Image handling ----------------------------- */

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImageError(null)

    // Client-side validation
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError(m.creator_shop_image_type_error())
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError(m.creator_shop_image_size_error())
      return
    }

    // Generate preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    setImageFile(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setImageError(null)
    // Reset the file input
    const input = document.getElementById('shop-image-upload') as HTMLInputElement
    if (input) input.value = ''
  }

  /* ---------------------------- Form submission ---------------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    setNameError(null)
    setSlugError(null)
    setDescriptionError(null)

    // Client-side validation
    if (!name.trim()) {
      setNameError(m.creator_shop_name_required())
      return
    }

    if (!slug.trim()) {
      setSlugError(m.creator_shop_slug_required())
      return
    }

    if (description.length > 2000) {
      setDescriptionError(m.creator_shop_description_too_long())
      return
    }

    setSaving(true)

    try {
      // 1. Update shop metadata
      const updatePayload: {
        shopId: string
        name?: string
        slug?: string
        description?: string
        shippingOrigin?: { street: string; city: string; postalCode: string; country: string } | null
      } = { shopId: shop.id }

      if (name !== shop.name) updatePayload.name = name.trim()
      if (slug !== shop.slug) updatePayload.slug = slug.trim()
      if (description !== (shop.description ?? ''))
        updatePayload.description = description.trim() || ''

      if (originChanged) {
        updatePayload.shippingOrigin =
          originStreet.trim() || originCity.trim() || originPostal.trim() || originCountry.trim()
            ? {
                street: originStreet.trim(),
                city: originCity.trim(),
                postalCode: originPostal.trim(),
                country: originCountry.trim().toUpperCase(),
              }
            : null
      }

      if (Object.keys(updatePayload).length > 1) {
        await updateShop({ data: updatePayload })
      }

      // 2. Upload image if changed
      if (imageFile && imagePreview) {
        await uploadShopImage({ data: { shopId: shop.id, dataUrl: imagePreview } })
      }

      setFeedback({ type: 'success', message: m.creator_shop_save_success() })
      setImageFile(null)

      // Refresh the page data
      onShopChanged()
    } catch (err) {
      // Handle known error shapes from server functions
      if (err instanceof Response) {
        try {
          const body = await err.json()
          if (err.status === 409) {
            setSlugError(body.message || m.creator_shop_slug_taken_error())
          } else if (err.status === 400) {
            setImageError(body.message || m.creator_shop_image_upload_error())
          } else {
            setFeedback({ type: 'error', message: body.message || m.creator_shop_save_error() })
          }
        } catch {
          setFeedback({ type: 'error', message: m.creator_shop_save_error() })
        }
      } else {
        setFeedback({ type: 'error', message: m.creator_shop_save_error() })
      }
    } finally {
      setSaving(false)
    }
  }

  /* ---------------------------- Shop switching ----------------------------- */

  const handleShopSwitch = (newShopId: string) => {
    router.navigate({ to: '/creator/shop', search: { shopId: newShopId } })
  }

  /* ------------------------------ Render ----------------------------------- */

  return (
    <main className='page-wrap px-4 py-8 sm:py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='display-title mb-2 text-3xl font-bold text-text-primary'>
            {m.creator_shop_settings_title()}
          </h1>
          <p className='text-text-secondary'>{m.creator_shop_settings_description()}</p>
        </div>

        {/* Shop selector (only shown when creator has multiple shops) */}
        {allShops.length > 1 && (
          <div className='mb-8'>
            <label
              htmlFor='shop-selector'
              className='mb-2 block text-sm font-medium text-text-primary'
            >
              {m.creator_shop_select_label()}
            </label>
            <select
              id='shop-selector'
              value={shop.id}
              onChange={(e) => handleShopSwitch(e.target.value)}
              className='flex h-10 w-full max-w-xs rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
            >
              {allShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
              {/* Shop name */}
              <div>
                <label
                  htmlFor='shop-name'
                  className='mb-2 block text-sm font-medium text-text-primary'
                >
                  {m.creator_shop_name_label()}
                </label>
                <Input
                  id='shop-name'
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={nameError ?? undefined}
                  placeholder={m.creator_shop_name_placeholder()}
                  maxLength={255}
                  required
                />
                {nameError && (
                  <p id='shop-name-error' className='mt-1 text-sm text-error'>
                    {nameError}
                  </p>
                )}
              </div>

              {/* Slug */}
              <div>
                <label
                  htmlFor='shop-slug'
                  className='mb-2 block text-sm font-medium text-text-primary'
                >
                  {m.creator_shop_slug_label()}
                </label>
                <div className='relative'>
                  <Input
                    id='shop-slug'
                    type='text'
                    value={slug}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/\s+/g, '-')
                      setSlug(val)
                    }}
                    error={slugError ? slugError : undefined}
                    placeholder={m.creator_shop_slug_placeholder()}
                    maxLength={100}
                    required
                  />
                  {slugChecking && (
                    <span className='absolute right-3 top-1/2 -translate-y-1/2'>
                      <svg
                        className='h-4 w-4 animate-spin text-text-muted'
                        xmlns='http://www.w3.org/2000/svg'
                        fill='none'
                        viewBox='0 0 24 24'
                        aria-label={m.creator_shop_slug_checking()}
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
                    </span>
                  )}
                  {!slugChecking && slugAvailable === true && (
                    <span className='absolute right-3 top-1/2 -translate-y-1/2 text-success'>
                      <Check size={16} aria-label={m.creator_shop_slug_available()} />
                    </span>
                  )}
                  {!slugChecking && slugAvailable === false && (
                    <span className='absolute right-3 top-1/2 -translate-y-1/2 text-error'>
                      <X size={16} aria-label={m.creator_shop_slug_unavailable()} />
                    </span>
                  )}
                </div>
                {slugError && (
                  <p id='shop-slug-error' className='mt-1 text-sm text-error'>
                    {slugError}
                  </p>
                )}
                <p className='mt-1 text-xs text-text-muted'>{m.creator_shop_slug_hint()}</p>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor='shop-description'
                  className='mb-2 block text-sm font-medium text-text-primary'
                >
                  {m.creator_shop_description_label()}
                </label>
                <textarea
                  id='shop-description'
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={m.creator_shop_description_placeholder()}
                  className={`w-full rounded-lg border bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 resize-y ${
                    descriptionError
                      ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
                      : 'border-border-default hover:border-border-strong focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20'
                  }`}
                  maxLength={2000}
                />
                <div className='mt-1 flex items-center justify-between'>
                  {descriptionError && (
                    <p id='shop-description-error' className='text-sm text-error'>
                      {descriptionError}
                    </p>
                  )}
                  <p className='text-xs text-text-muted ml-auto'>{description.length}/2000</p>
                </div>
              </div>

              {/* Shipping Origin */}
              <div className='rounded-xl border border-border-subtle p-4'>
                <h3 className='mb-3 text-sm font-semibold text-text-primary'>
                  Shipping Origin Address
                </h3>
                <p className='mb-3 text-xs text-text-muted'>
                  Used to generate shipping labels for your orders.
                </p>
                <div className='space-y-3'>
                  <div>
                    <label
                      htmlFor='origin-street'
                      className='mb-1.5 block text-xs font-medium text-text-secondary'
                    >
                      Street
                    </label>
                    <Input
                      id='origin-street'
                      type='text'
                      value={originStreet}
                      onChange={(e) => setOriginStreet(e.target.value)}
                      placeholder='123 Main St'
                    />
                  </div>
                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <label
                        htmlFor='origin-city'
                        className='mb-1.5 block text-xs font-medium text-text-secondary'
                      >
                        City
                      </label>
                      <Input
                        id='origin-city'
                        type='text'
                        value={originCity}
                        onChange={(e) => setOriginCity(e.target.value)}
                        placeholder='Berlin'
                      />
                    </div>
                    <div>
                      <label
                        htmlFor='origin-postal'
                        className='mb-1.5 block text-xs font-medium text-text-secondary'
                      >
                        Postal Code
                      </label>
                      <Input
                        id='origin-postal'
                        type='text'
                        value={originPostal}
                        onChange={(e) => setOriginPostal(e.target.value)}
                        placeholder='10115'
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor='origin-country'
                      className='mb-1.5 block text-xs font-medium text-text-secondary'
                    >
                      Country (2-letter code)
                    </label>
                    <Input
                      id='origin-country'
                      type='text'
                      value={originCountry}
                      onChange={(e) =>
                        setOriginCountry(e.target.value.toUpperCase().slice(0, 2))
                      }
                      placeholder='DE'
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: image upload */}
            <div>
              <label
                htmlFor='shop-image-upload'
                className='mb-2 block text-sm font-medium text-text-primary'
              >
                {m.creator_shop_image_label()}
              </label>
              <p className='mb-3 text-xs text-text-muted'>{m.creator_shop_image_hint()}</p>

              {/* Image preview */}
              {imagePreview ? (
                <div className='relative mb-3 overflow-hidden rounded-lg border border-border-default'>
                  <img
                    src={imagePreview}
                    alt={m.creator_shop_image_preview_alt()}
                    className='aspect-video w-full object-cover'
                  />
                  <button
                    type='button'
                    onClick={handleRemoveImage}
                    className='absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-bg-overlay text-white backdrop-blur-sm transition hover:bg-error'
                    aria-label={m.creator_shop_image_remove()}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className='mb-3 flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-border-default bg-surface-inset'>
                  <div className='text-center'>
                    <ImageIcon
                      size={32}
                      className='mx-auto mb-2 text-text-muted'
                      aria-hidden='true'
                    />
                    <p className='text-sm text-text-muted'>{m.creator_shop_image_empty()}</p>
                  </div>
                </div>
              )}

              {/* File input */}
              <div>
                <input
                  id='shop-image-upload'
                  type='file'
                  accept='image/jpeg,image/png,image/webp'
                  onChange={handleImageSelect}
                  className='hidden'
                />
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={() => document.getElementById('shop-image-upload')?.click()}
                  className='w-full'
                >
                  <Upload size={16} aria-hidden='true' />
                  {imagePreview ? m.creator_shop_image_change() : m.creator_shop_image_upload()}
                </Button>
              </div>

              {imageError && <p className='mt-2 text-sm text-error'>{imageError}</p>}
            </div>
          </div>

          {/* Submit */}
          <div className='mt-8 flex items-center gap-4 border-t border-border-subtle pt-6'>
            <Button
              type='submit'
              variant='primary'
              isLoading={saving}
              disabled={!hasChanges || slugChecking}
            >
              {saving ? m.creator_shop_saving() : m.creator_shop_save()}
            </Button>
            {hasChanges && (
              <Button
                type='button'
                variant='ghost'
                onClick={() => {
                  setName(shop.name)
                  setSlug(shop.slug)
                  setDescription(shop.description ?? '')
                  setOriginStreet(shop.shippingOrigin?.street ?? '')
                  setOriginCity(shop.shippingOrigin?.city ?? '')
                  setOriginPostal(shop.shippingOrigin?.postalCode ?? '')
                  setOriginCountry(shop.shippingOrigin?.country ?? '')
                  setImageFile(null)
                  setImagePreview(shop.image ?? null)
                  setImageError(null)
                  setSlugError(null)
                  setSlugAvailable(null)
                  setNameError(null)
                  setDescriptionError(null)
                  setFeedback(null)
                }}
              >
                {m.creator_shop_cancel()}
              </Button>
            )}
          </div>
        </form>
      </section>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                               Empty States                                 */
/* -------------------------------------------------------------------------- */

function NoShopState() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='py-12 text-center'>
          <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <h2 className='mb-2 text-xl font-semibold text-text-primary'>
            {m.creator_no_shops_title()}
          </h2>
          <p className='mx-auto max-w-md text-text-secondary'>{m.creator_no_shops_description()}</p>
        </div>
      </section>
    </main>
  )
}

function ShopNotFoundState() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='py-12 text-center'>
          <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <h2 className='mb-2 text-xl font-semibold text-text-primary'>
            {m.creator_shop_not_found()}
          </h2>
          <p className='mx-auto max-w-md text-text-secondary'>
            {m.creator_shop_not_found_description()}
          </p>
        </div>
      </section>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Loading / Error                                */
/* -------------------------------------------------------------------------- */

export function CreatorShopSettingsLoading() {
  return (
    <main className='page-wrap px-4 py-8 sm:py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-2 h-9 w-72' />
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
          </div>
          <div>
            <Skeleton className='mb-2 h-4 w-20' />
            <Skeleton className='mb-3 aspect-video w-full rounded-lg' />
            <Skeleton className='h-8 w-full' />
          </div>
        </div>

        <div className='mt-8 border-t border-border-subtle pt-6'>
          <Skeleton className='h-10 w-32' />
        </div>
      </section>
    </main>
  )
}

export function CreatorShopSettingsError({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <main className='page-wrap px-4 py-8 sm:py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-bold text-text-primary'>
          {m.creator_shop_settings_title()}
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
