import { useRouter } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import type { CreatorShopDetail } from '#/lib/creator-dashboard'
import { checkShopSlug, updateShop } from '#/lib/shop-settings'
import { useImageUpload } from '#/hooks/useImageUpload'
import { getImageUrl } from '#/lib/image-url'
import { m } from '#/paraglide/messages'
import { useCallback, useReducer, useRef, useState } from 'react'
import { ShopSelector } from './ShopSelector'
import { ShopSettingsFormFields } from './ShopSettingsFormFields'
import { ShopSettingsImageUploader } from './ShopSettingsImageUploader'
import { ShopSettingsShippingOrigin } from './ShopSettingsShippingOrigin'
import { ShopSettingsVatSettings } from './ShopSettingsVatSettings'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface FeedbackState {
  type: 'success' | 'error'
  message: string
}

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const SLUG_DEBOUNCE_MS = 400

/* -------------------------------------------------------------------------- */
/*                               Form reducer                                 */
/* -------------------------------------------------------------------------- */

export interface FormValues {
  name: string
  slug: string
  description: string
  originStreet: string
  originCity: string
  originPostal: string
  originCountry: string
  isVatRegistered: boolean
  vatId: string
}

interface FormState {
  values: FormValues
  nameError: string | null
  descriptionError: string | null
  vatIdError: string | null
  slugError: string | null
  slugAvailable: boolean | null
  slugChecking: boolean
}

type FormAction =
  | { type: 'setField'; field: keyof FormValues; value: FormValues[keyof FormValues] }
  | { type: 'setNameError'; error: string | null }
  | { type: 'setDescriptionError'; error: string | null }
  | { type: 'setVatIdError'; error: string | null }
  | { type: 'setSlugError'; error: string | null }
  | { type: 'setSlugAvailable'; available: boolean | null }
  | { type: 'setSlugChecking'; checking: boolean }
  | { type: 'reset'; shop: CreatorShopDetail }

function createInitialFormState(shop: CreatorShopDetail): FormState {
  return {
    values: {
      name: shop.name,
      slug: shop.slug,
      description: shop.description ?? '',
      originStreet: shop.shippingOrigin?.street ?? '',
      originCity: shop.shippingOrigin?.city ?? '',
      originPostal: shop.shippingOrigin?.postalCode ?? '',
      originCountry: shop.shippingOrigin?.country ?? '',
      isVatRegistered: shop.isVatRegistered,
      vatId: shop.vatId ?? '',
    },
    nameError: null,
    descriptionError: null,
    vatIdError: null,
    slugError: null,
    slugAvailable: null,
    slugChecking: false,
  }
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'setField':
      return { ...state, values: { ...state.values, [action.field]: action.value } } as FormState
    case 'setNameError':
      return { ...state, nameError: action.error }
    case 'setDescriptionError':
      return { ...state, descriptionError: action.error }
    case 'setVatIdError':
      return { ...state, vatIdError: action.error }
    case 'setSlugError':
      return { ...state, slugError: action.error }
    case 'setSlugAvailable':
      return { ...state, slugAvailable: action.available }
    case 'setSlugChecking':
      return { ...state, slugChecking: action.checking }
    case 'reset':
      return createInitialFormState(action.shop)
    default:
      return state
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

interface ShopSettingsFormProps {
  initialShop: CreatorShopDetail
  allShops: Array<{ id: string; name: string }>
  onShopChanged: () => void
}

export function ShopSettingsForm({ initialShop, allShops, onShopChanged }: ShopSettingsFormProps) {
  const router = useRouter()

  const [formState, dispatchForm] = useReducer(formReducer, initialShop, createInitialFormState)

  const [imageKey, setImageKey] = useState<string | null>(initialShop.image ?? null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialShop.image ? getImageUrl(initialShop.image) : null,
  )
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)

  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [submissionState, dispatchSubmission] = useReducer(
    (
      state: { saving: boolean; feedback: FeedbackState | null },
      action: { type: string; feedback?: FeedbackState | null },
    ) => {
      switch (action.type) {
        case 'start':
          return { saving: true, feedback: null }
        case 'set':
          return { ...state, feedback: action.feedback ?? null }
        case 'done':
          return { ...state, saving: false }
        default:
          return state
      }
    },
    { saving: false, feedback: null },
  )

  const { upload, error: uploadError } = useImageUpload()

  const slugChanged = formState.values.slug !== initialShop.slug
  const imageChanged = imageKey !== initialShop.image
  const originChanged =
    formState.values.originStreet !== (initialShop.shippingOrigin?.street ?? '') ||
    formState.values.originCity !== (initialShop.shippingOrigin?.city ?? '') ||
    formState.values.originPostal !== (initialShop.shippingOrigin?.postalCode ?? '') ||
    formState.values.originCountry !== (initialShop.shippingOrigin?.country ?? '')
  const vatChanged =
    formState.values.isVatRegistered !== initialShop.isVatRegistered ||
    formState.values.vatId !== (initialShop.vatId ?? '')
  const hasChanges =
    formState.values.name !== initialShop.name ||
    slugChanged ||
    formState.values.description !== (initialShop.description ?? '') ||
    imageChanged ||
    originChanged ||
    vatChanged

  /* ----------------------------- Slug validation ---------------------------- */

  const checkSlug = useCallback(
    async (value: string) => {
      if (value === initialShop.slug) {
        dispatchForm({ type: 'setSlugError', error: null })
        dispatchForm({ type: 'setSlugAvailable', available: null })
        dispatchForm({ type: 'setSlugChecking', checking: false })
        return
      }

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
        dispatchForm({ type: 'setSlugError', error: m.creator_shop_slug_format_error() })
        dispatchForm({ type: 'setSlugAvailable', available: null })
        dispatchForm({ type: 'setSlugChecking', checking: false })
        return
      }

      dispatchForm({ type: 'setSlugChecking', checking: true })
      dispatchForm({ type: 'setSlugError', error: null })

      try {
        const result = await checkShopSlug({ data: { slug: value, excludeShopId: initialShop.id } })
        if (result.available) {
          dispatchForm({ type: 'setSlugAvailable', available: true })
          dispatchForm({ type: 'setSlugError', error: null })
        } else {
          dispatchForm({ type: 'setSlugAvailable', available: false })
          dispatchForm({ type: 'setSlugError', error: m.creator_shop_slug_taken_error() })
        }
      } catch {
        dispatchForm({ type: 'setSlugError', error: m.creator_shop_slug_check_error() })
        dispatchForm({ type: 'setSlugAvailable', available: null })
      } finally {
        dispatchForm({ type: 'setSlugChecking', checking: false })
      }
    },
    [initialShop.id, initialShop.slug],
  )

  const handleSlugChange = (val: string) => {
    dispatchForm({ type: 'setField', field: 'slug', value: val })
    if (slugTimerRef.current) {
      clearTimeout(slugTimerRef.current)
    }
    slugTimerRef.current = setTimeout(() => {
      checkSlug(val)
    }, SLUG_DEBOUNCE_MS)
  }

  /* ---------------------------- Image handling ----------------------------- */

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImageError(null)

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError(m.creator_shop_image_type_error())
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError(m.creator_shop_image_size_error())
      return
    }

    setImageUploading(true)
    setImagePreview(URL.createObjectURL(file))

    try {
      const result = await upload(file, 'shops')
      if (result) {
        setImageKey(result.key)
        setImagePreview(result.previewUrl)
      } else {
        setImageError(uploadError ?? 'Upload failed')
        setImagePreview(null)
        setImageKey(null)
      }
    } catch {
      setImageError('Upload failed')
      setImagePreview(null)
      setImageKey(null)
    } finally {
      setImageUploading(false)
      const input = document.getElementById('shop-image-upload') as HTMLInputElement
      if (input) input.value = ''
    }
  }

  const handleRemoveImage = () => {
    setImageKey(null)
    setImagePreview(null)
    setImageError(null)
    const input = document.getElementById('shop-image-upload') as HTMLInputElement
    if (input) input.value = ''
  }

  /* ---------------------------- Form submission ---------------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    dispatchSubmission({ type: 'set', feedback: null })
    dispatchForm({ type: 'setNameError', error: null })
    dispatchForm({ type: 'setSlugError', error: null })
    dispatchForm({ type: 'setDescriptionError', error: null })

    if (!formState.values.name.trim()) {
      dispatchForm({ type: 'setNameError', error: m.creator_shop_name_required() })
      return
    }

    if (!formState.values.slug.trim()) {
      dispatchForm({ type: 'setSlugError', error: m.creator_shop_slug_required() })
      return
    }

    if (formState.values.description.length > 2000) {
      dispatchForm({ type: 'setDescriptionError', error: m.creator_shop_description_too_long() })
      return
    }

    if (formState.values.isVatRegistered && !formState.values.vatId.trim()) {
      dispatchForm({ type: 'setVatIdError', error: 'VAT ID is required when VAT registered' })
      return
    }

    dispatchSubmission({ type: 'start' })

    try {
      const updatePayload: {
        shopId: string
        name?: string
        slug?: string
        description?: string
        shippingOrigin?: {
          street: string
          city: string
          postalCode: string
          country: string
        } | null
        isVatRegistered?: boolean
        vatId?: string | null
        image?: string | null
      } = { shopId: initialShop.id }

      if (formState.values.name !== initialShop.name)
        updatePayload.name = formState.values.name.trim()
      if (formState.values.slug !== initialShop.slug)
        updatePayload.slug = formState.values.slug.trim()
      if (formState.values.description !== (initialShop.description ?? ''))
        updatePayload.description = formState.values.description.trim() || ''

      if (originChanged) {
        updatePayload.shippingOrigin =
          formState.values.originStreet.trim() ||
          formState.values.originCity.trim() ||
          formState.values.originPostal.trim() ||
          formState.values.originCountry.trim()
            ? {
                street: formState.values.originStreet.trim(),
                city: formState.values.originCity.trim(),
                postalCode: formState.values.originPostal.trim(),
                country: formState.values.originCountry.trim().toUpperCase(),
              }
            : null
      }

      if (vatChanged) {
        updatePayload.isVatRegistered = formState.values.isVatRegistered
        updatePayload.vatId = formState.values.isVatRegistered
          ? formState.values.vatId.trim() || null
          : null
      }

      if (imageChanged) {
        updatePayload.image = imageKey
      }

      if (Object.keys(updatePayload).length > 1) {
        await updateShop({ data: updatePayload })
      }

      dispatchSubmission({
        type: 'set',
        feedback: { type: 'success', message: m.creator_shop_save_success() },
      })

      onShopChanged()
    } catch (err) {
      if (err instanceof Response) {
        try {
          const body = await err.json()
          if (err.status === 409) {
            dispatchForm({
              type: 'setSlugError',
              error: body.message || m.creator_shop_slug_taken_error(),
            })
          } else if (err.status === 400) {
            setImageError(body.message || m.creator_shop_image_upload_error())
          } else {
            dispatchSubmission({
              type: 'set',
              feedback: { type: 'error', message: body.message || m.creator_shop_save_error() },
            })
          }
        } catch {
          dispatchSubmission({
            type: 'set',
            feedback: { type: 'error', message: m.creator_shop_save_error() },
          })
        }
      } else {
        dispatchSubmission({
          type: 'set',
          feedback: { type: 'error', message: m.creator_shop_save_error() },
        })
      }
    } finally {
      dispatchSubmission({ type: 'done' })
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
          <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
            {m.creator_shop_settings_title()}
          </h1>
          <p className='text-text-secondary'>{m.creator_shop_settings_description()}</p>
        </div>

        <ShopSelector
          label={m.creator_shop_select_label()}
          shops={allShops}
          currentShopId={initialShop.id}
          onChange={handleShopSwitch}
        />

        {/* Feedback banner */}
        {submissionState.feedback && (
          <FeedbackBanner
            type={submissionState.feedback.type}
            message={submissionState.feedback.message}
          />
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className='grid gap-8 lg:grid-cols-3'>
            {/* Left column: text fields */}
            <div className='space-y-5 lg:col-span-2'>
              <ShopSettingsFormFields
                values={formState.values}
                nameError={formState.nameError}
                slugError={formState.slugError}
                descriptionError={formState.descriptionError}
                slugChecking={formState.slugChecking}
                slugAvailable={formState.slugAvailable}
                onNameChange={(value) => dispatchForm({ type: 'setField', field: 'name', value })}
                onSlugChange={handleSlugChange}
                onDescriptionChange={(value) =>
                  dispatchForm({ type: 'setField', field: 'description', value })
                }
              />

              <ShopSettingsShippingOrigin
                originStreet={formState.values.originStreet}
                originCity={formState.values.originCity}
                originPostal={formState.values.originPostal}
                originCountry={formState.values.originCountry}
                onStreetChange={(value) =>
                  dispatchForm({ type: 'setField', field: 'originStreet', value })
                }
                onCityChange={(value) =>
                  dispatchForm({ type: 'setField', field: 'originCity', value })
                }
                onPostalChange={(value) =>
                  dispatchForm({ type: 'setField', field: 'originPostal', value })
                }
                onCountryChange={(value) =>
                  dispatchForm({ type: 'setField', field: 'originCountry', value })
                }
              />

              <ShopSettingsVatSettings
                isVatRegistered={formState.values.isVatRegistered}
                vatId={formState.values.vatId}
                vatIdError={formState.vatIdError}
                onVatRegisteredChange={(value) =>
                  dispatchForm({ type: 'setField', field: 'isVatRegistered', value })
                }
                onVatIdChange={(value) => dispatchForm({ type: 'setField', field: 'vatId', value })}
                onVatIdErrorClear={() => dispatchForm({ type: 'setVatIdError', error: null })}
              />
            </div>

            <ShopSettingsImageUploader
              imagePreview={imagePreview}
              imageError={imageError}
              onImageSelect={handleImageSelect}
              onRemoveImage={handleRemoveImage}
            />
          </div>

          {/* Submit */}
          <div className='mt-8 flex items-center gap-4 border-t border-border-subtle pt-6'>
            <Button
              type='submit'
              variant='primary'
              isLoading={submissionState.saving}
              disabled={!hasChanges || formState.slugChecking || imageUploading}
            >
              {submissionState.saving ? m.creator_shop_saving() : m.creator_shop_save()}
            </Button>
            {hasChanges && (
              <Button
                type='button'
                variant='ghost'
                onClick={() => {
                  dispatchForm({ type: 'reset', shop: initialShop })
                  setImageKey(initialShop.image ?? null)
                  setImagePreview(initialShop.image ? getImageUrl(initialShop.image) : null)
                  setImageError(null)
                  dispatchSubmission({ type: 'set', feedback: null })
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
