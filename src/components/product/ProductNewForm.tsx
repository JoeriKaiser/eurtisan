import { useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { CreatorShop } from '#/lib/creator-dashboard'
import { createProduct } from '#/lib/creator-products'
import { useImageUpload } from '#/hooks/useImageUpload'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import { CancelConfirmationDialog } from './CancelConfirmationDialog'
import { ProductNewImageUploader, type UploadedImage } from './ProductNewImageUploader'
import { ProductNewFormFields } from './ProductNewFormFields'

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

const MAX_IMAGES = 10
const SLUG_DEBOUNCE_MS = 400

/* -------------------------------------------------------------------------- */
/*                          Module-scope pure functions                       */
/* -------------------------------------------------------------------------- */

function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/* -------------------------------------------------------------------------- */
/*                               Form reducer                                 */
/* -------------------------------------------------------------------------- */

export interface FormValues {
  shopId: string
  name: string
  slug: string
  description: string
  price: string
  stockCount: string
  categoryId: string
  isActive: boolean
  vatRateCategory: 'standard' | 'reduced' | 'exempt'
}

interface FormState {
  values: FormValues
  fieldErrors: Record<string, string>
  slugError: string | null
}

type FormAction =
  | { type: 'setField'; field: keyof FormValues; value: FormValues[keyof FormValues] }
  | { type: 'setFieldErrors'; errors: Record<string, string> }
  | { type: 'mergeFieldErrors'; errors: Record<string, string> }
  | { type: 'setSlugError'; error: string | null }
  | { type: 'clearFieldError'; field: string }
  | { type: 'reset'; initialShops: CreatorShop[] }

function createInitialFormState(initialShops: CreatorShop[]): FormState {
  return {
    values: {
      shopId: initialShops[0].id,
      name: '',
      slug: '',
      description: '',
      price: '',
      stockCount: '0',
      categoryId: '',
      isActive: true,
      vatRateCategory: 'standard',
    },
    fieldErrors: {},
    slugError: null,
  }
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'setField':
      return { ...state, values: { ...state.values, [action.field]: action.value } } as FormState
    case 'setFieldErrors':
      return { ...state, fieldErrors: action.errors }
    case 'mergeFieldErrors':
      return { ...state, fieldErrors: { ...state.fieldErrors, ...action.errors } }
    case 'setSlugError':
      return { ...state, slugError: action.error }
    case 'clearFieldError': {
      const next = { ...state.fieldErrors }
      delete next[action.field]
      return { ...state, fieldErrors: next }
    }
    case 'reset':
      return createInitialFormState(action.initialShops)
    default:
      return state
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

interface ProductNewFormProps {
  initialShops: CreatorShop[]
  categories: Array<{ id: string; name: string; slug: string }>
}

export function ProductNewForm({ initialShops, categories }: ProductNewFormProps) {
  const router = useRouter()

  const [formState, dispatchForm] = useReducer(formReducer, initialShops, createInitialFormState)
  const [images, setImages] = useState<UploadedImage[]>([])

  const slugManuallyEditedRef = useRef(false)
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const { uploadMultiple, error: uploadError } = useImageUpload()

  const hasChanges =
    formState.values.name !== '' ||
    formState.values.description !== '' ||
    formState.values.price !== '' ||
    formState.values.stockCount !== '0' ||
    formState.values.categoryId !== '' ||
    images.length > 0

  /* ------------------------ Slug auto-generation --------------------------- */

  const handleNameChange = (value: string) => {
    dispatchForm({ type: 'setField', field: 'name', value })
    if (!slugManuallyEditedRef.current) {
      const autoSlug = generateSlug(value)
      dispatchForm({ type: 'setField', field: 'slug', value: autoSlug })
    }
  }

  const handleSlugChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/\s+/g, '-')
    dispatchForm({ type: 'setField', field: 'slug', value: cleaned })
    slugManuallyEditedRef.current = true
  }

  // Debounced slug format validation
  useEffect(() => {
    if (slugTimerRef.current) {
      clearTimeout(slugTimerRef.current)
    }

    slugTimerRef.current = setTimeout(() => {
      dispatchForm({
        type: 'setSlugError',
        error: !formState.values.slug
          ? null
          : !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formState.values.slug)
            ? m.creator_product_new_slug_format_error()
            : null,
      })
    }, SLUG_DEBOUNCE_MS)

    return () => {
      if (slugTimerRef.current) {
        clearTimeout(slugTimerRef.current)
      }
    }
  }, [formState.values.slug])

  /* ---------------------------- Image handling ----------------------------- */

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      const remaining = MAX_IMAGES - images.length
      if (remaining <= 0) {
        dispatchForm({
          type: 'mergeFieldErrors',
          errors: { images: m.creator_product_new_images_error_max() },
        })
        return
      }

      const filesToAdd = Array.from(files).slice(0, remaining)

      const placeholders: UploadedImage[] = filesToAdd.map((file) => ({
        id: crypto.randomUUID(),
        key: '',
        previewUrl: URL.createObjectURL(file),
        altText: '',
        uploading: true,
        error: null,
      }))

      setImages((prev) => [...prev, ...placeholders])
      dispatchForm({ type: 'clearFieldError', field: 'images' })

      const results = await uploadMultiple(filesToAdd, 'products')

      setImages((prev) =>
        prev.map((img) => {
          const placeholder = placeholders.find((p) => p.id === img.id)
          if (!placeholder) return img
          const idx = placeholders.indexOf(placeholder)
          const result = results[idx]
          if (!result) {
            return { ...img, uploading: false, error: uploadError ?? 'Upload failed' }
          }
          return {
            ...img,
            key: result.key,
            previewUrl: result.previewUrl,
            uploading: false,
          }
        }),
      )

      const input = document.getElementById('product-image-upload') as HTMLInputElement
      if (input) input.value = ''
    },
    [images.length, uploadMultiple, uploadError],
  )

  const handleRemoveImage = (imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId))
  }

  /* ---------------------------- Form validation ---------------------------- */

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {}

    if (!formState.values.name.trim()) {
      errors.name = m.creator_product_new_name_required()
    }

    if (!formState.values.slug.trim()) {
      errors.slug = m.creator_product_new_slug_required()
    } else if (formState.slugError) {
      errors.slug = formState.slugError
    }

    if (formState.values.description.length > 2000) {
      errors.description = m.creator_product_new_description_too_long()
    }

    const priceNum = Number.parseFloat(formState.values.price)
    if (!formState.values.price || Number.isNaN(priceNum)) {
      errors.price = m.creator_product_new_price_required()
    } else if (priceNum <= 0) {
      errors.price = m.creator_product_new_price_positive()
    }

    const stockNum = Number.parseInt(formState.values.stockCount, 10)
    if (Number.isNaN(stockNum) || stockNum < 0) {
      errors.stock = m.creator_product_new_stock_negative()
    }

    const erroredImages = images.filter((img) => img.error)
    if (erroredImages.length > 0) {
      errors.images = m.creator_product_new_images_error_type()
    }

    dispatchForm({ type: 'setFieldErrors', errors })
    return Object.keys(errors).length === 0
  }, [formState.values, formState.slugError, images])

  /* ---------------------------- Form submission ---------------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    if (!validateForm()) return

    setSubmitting(true)

    try {
      const priceCents = Math.round(Number.parseFloat(formState.values.price) * 100)

      await createProduct({
        data: {
          shopId: formState.values.shopId,
          name: formState.values.name.trim(),
          slug: formState.values.slug.trim(),
          description: formState.values.description.trim() || undefined,
          priceCents,
          stockCount: Number.parseInt(formState.values.stockCount, 10) || 0,
          categoryId: formState.values.categoryId || undefined,
          isActive: formState.values.isActive,
          vatRateCategory: formState.values.vatRateCategory,
          images: images
            .filter((img) => !img.error && !img.uploading && img.key)
            .map((img) => ({ key: img.key, altText: img.altText || undefined })),
        },
      })

      setFeedback({ type: 'success', message: m.creator_product_new_save_success() })

      setTimeout(() => {
        router.navigate({ to: '/creator/products' })
      }, 800)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'DUPLICATE_SLUG') {
          dispatchForm({
            type: 'mergeFieldErrors',
            errors: { slug: m.creator_product_new_slug_duplicate() },
          })
        } else if (err.message === 'Invalid category_id') {
          dispatchForm({
            type: 'mergeFieldErrors',
            errors: { categoryId: m.creator_product_new_category_invalid() },
          })
        } else if (
          err.message.includes('Invalid') ||
          err.message.includes('image') ||
          err.message.includes('Image')
        ) {
          dispatchForm({
            type: 'mergeFieldErrors',
            errors: { images: err.message },
          })
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
          <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
            {m.creator_product_new_title()}
          </h1>
          <p className='text-text-secondary'>{m.creator_product_new_description()}</p>
        </div>

        {/* Feedback banner */}
        {feedback && <FeedbackBanner type={feedback.type} message={feedback.message} />}

        <form onSubmit={handleSubmit} noValidate>
          <div className='grid gap-8 lg:grid-cols-3'>
            <ProductNewFormFields
              initialShops={initialShops}
              categories={categories}
              values={formState.values}
              fieldErrors={formState.fieldErrors}
              slugError={formState.slugError}
              onNameChange={handleNameChange}
              onSlugChange={handleSlugChange}
              onFieldChange={(field, value) => dispatchForm({ type: 'setField', field, value })}
            />

            <ProductNewImageUploader
              images={images}
              maxImages={MAX_IMAGES}
              fieldError={formState.fieldErrors.images}
              onImageSelect={handleImageSelect}
              onRemoveImage={handleRemoveImage}
            />
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

      <CancelConfirmationDialog
        open={showCancelConfirm}
        title={m.creator_product_new_unsaved_title()}
        description={m.creator_product_new_unsaved_description()}
        cancelLabel={m.creator_product_new_unsaved_cancel()}
        confirmLabel={m.creator_product_new_unsaved_confirm()}
        onCancel={handleDismissCancel}
        onConfirm={handleConfirmCancel}
      />
    </main>
  )
}
