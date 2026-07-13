import { useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useCallback, useReducer, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import { useImageUpload } from '#/hooks/useImageUpload'
import { useManagedTimeouts } from '#/hooks/useManagedTimeouts'
import type { CreatorShop } from '#/lib/creator-dashboard'
import { createProduct } from '#/lib/creator-products'
import { createProductSchema } from '#/lib/creator-products.schema'
import { m } from '#/paraglide/messages'
import { CancelConfirmationDialog } from './CancelConfirmationDialog'
import { ProductNewFormFields } from './ProductNewFormFields'
import { ProductNewImageUploader, type UploadedImage } from './ProductNewImageUploader'

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
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
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
  status: 'draft' | 'published'
  vatRateCategory: 'standard' | 'reduced' | 'exempt'
  weightGrams: string
  lengthCm: string
  widthCm: string
  heightCm: string
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
      status: 'published',
      vatRateCategory: 'standard',
      weightGrams: '',
      lengthCm: '',
      widthCm: '',
      heightCm: '',
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
  const { schedule } = useManagedTimeouts()

  const [formState, dispatchForm] = useReducer(formReducer, initialShops, createInitialFormState)
  const [images, setImages] = useState<UploadedImage[]>([])

  const slugManuallyEditedRef = useRef(false)

  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const submitStatusRef = useRef<'draft' | 'published'>('published')

  const { uploadMultiple, error: uploadError } = useImageUpload()

  const hasChanges =
    formState.values.name !== '' ||
    formState.values.description !== '' ||
    formState.values.price !== '' ||
    formState.values.stockCount !== '0' ||
    formState.values.weightGrams !== '' ||
    formState.values.lengthCm !== '' ||
    formState.values.widthCm !== '' ||
    formState.values.heightCm !== '' ||
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
    dispatchForm({
      type: 'setSlugError',
      error:
        cleaned && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleaned)
          ? m.creator_product_new_slug_format_error()
          : null,
    })
    slugManuallyEditedRef.current = true
  }

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

      const placeholders: UploadedImage[] = filesToAdd.map((file) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
          return {
            id: crypto.randomUUID(),
            key: '',
            previewUrl: '',
            altText: '',
            uploading: false,
            error: m.creator_product_new_images_error_type(),
          }
        }
        if (file.size > MAX_IMAGE_SIZE) {
          return {
            id: crypto.randomUUID(),
            key: '',
            previewUrl: '',
            altText: '',
            uploading: false,
            error: m.creator_product_new_images_error_size(),
          }
        }
        return {
          id: crypto.randomUUID(),
          key: '',
          previewUrl: URL.createObjectURL(file),
          altText: '',
          uploading: true,
          error: null,
        }
      })

      setImages((prev) => [...prev, ...placeholders])
      dispatchForm({ type: 'clearFieldError', field: 'images' })

      const validFiles = filesToAdd.filter((_file, index) => !placeholders[index]?.error)
      const results = validFiles.length > 0 ? await uploadMultiple(validFiles, 'products') : []

      setImages((prev) =>
        prev.map((img) => {
          const placeholder = placeholders.find((p) => p.id === img.id)
          if (!placeholder) return img
          if (placeholder.error) return img
          const validIndex = validFiles.indexOf(filesToAdd[placeholders.indexOf(placeholder)])
          if (validIndex < 0) return img
          const result = results[validIndex]
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
    const priceCents = Math.round(Number.parseFloat(formState.values.price) * 100)

    const payload = {
      shopId: formState.values.shopId,
      name: formState.values.name.trim(),
      slug: formState.values.slug.trim(),
      description: formState.values.description.trim() || undefined,
      priceCents,
      stockCount: Number.parseInt(formState.values.stockCount, 10) || 0,
      categoryId: formState.values.categoryId || undefined,
      isActive: formState.values.isActive,
      vatRateCategory: formState.values.vatRateCategory,
      weightGrams: formState.values.weightGrams
        ? Number.parseInt(formState.values.weightGrams, 10)
        : undefined,
      lengthCm: formState.values.lengthCm
        ? Number.parseInt(formState.values.lengthCm, 10)
        : undefined,
      widthCm: formState.values.widthCm ? Number.parseInt(formState.values.widthCm, 10) : undefined,
      heightCm: formState.values.heightCm
        ? Number.parseInt(formState.values.heightCm, 10)
        : undefined,
      images: images.flatMap((img) =>
        !img.error && !img.uploading && img.key
          ? [{ key: img.key, altText: img.altText || undefined }]
          : [],
      ),
    }

    const result = createProductSchema.safeParse(payload)
    if (!result.success) {
      const errors: Record<string, string> = {}

      for (const issue of result.error.issues) {
        const field = issue.path[0] as string
        if (errors[field]) continue

        switch (field) {
          case 'name':
            errors.name =
              issue.code === 'too_big'
                ? m.creator_product_new_name_too_long()
                : m.creator_product_new_name_required()
            break
          case 'slug':
            if (issue.code === 'too_big') {
              errors.slug = m.creator_product_new_slug_too_long()
            } else if (issue.code === 'invalid_string') {
              errors.slug = m.creator_product_new_slug_format_error()
            } else {
              errors.slug = m.creator_product_new_slug_required()
            }
            break
          case 'description':
            errors.description = m.creator_product_new_description_too_long()
            break
          case 'priceCents':
            if (!formState.values.price.trim() || Number.isNaN(priceCents)) {
              errors.price = m.creator_product_new_price_required()
            } else if (issue.code === 'too_big') {
              errors.price = m.creator_product_new_price_too_high()
            } else {
              errors.price = m.creator_product_new_price_positive()
            }
            break
          case 'stockCount':
            errors.stock = m.creator_product_new_stock_negative()
            break
          case 'images':
            errors.images =
              issue.code === 'too_big'
                ? m.creator_product_new_images_error_max()
                : m.creator_product_new_images_error_type()
            break
          case 'categoryId':
            errors.categoryId = m.creator_product_new_category_invalid()
            break
          default:
            errors[field] = issue.message
        }
      }

      // Also surface any debounced slug format error not caught by Zod
      if (!errors.slug && formState.slugError) {
        errors.slug = formState.slugError
      }

      dispatchForm({ type: 'setFieldErrors', errors })
      return false
    }

    // Surface debounced slug format error even if Zod passes
    if (formState.slugError) {
      dispatchForm({ type: 'setFieldErrors', errors: { slug: formState.slugError } })
      return false
    }

    // Check for images that failed upload (these are filtered out of the payload,
    // but we should still warn the user before submission).
    const erroredImages = images.filter((img) => img.error)
    if (erroredImages.length > 0) {
      dispatchForm({
        type: 'setFieldErrors',
        errors: { images: m.creator_product_new_images_error_type() },
      })
      return false
    }

    dispatchForm({ type: 'setFieldErrors', errors: {} })
    return true
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
          status: submitStatusRef.current,
          vatRateCategory: formState.values.vatRateCategory,
          weightGrams: formState.values.weightGrams
            ? Number.parseInt(formState.values.weightGrams, 10)
            : undefined,
          lengthCm: formState.values.lengthCm
            ? Number.parseInt(formState.values.lengthCm, 10)
            : undefined,
          widthCm: formState.values.widthCm
            ? Number.parseInt(formState.values.widthCm, 10)
            : undefined,
          heightCm: formState.values.heightCm
            ? Number.parseInt(formState.values.heightCm, 10)
            : undefined,
          images: images.flatMap((img) =>
            !img.error && !img.uploading && img.key
              ? [{ key: img.key, altText: img.altText || undefined }]
              : [],
          ),
        },
      })

      setFeedback({ type: 'success', message: m.creator_product_new_save_success() })

      schedule(
        'post-create-navigation',
        () => {
          router.navigate({ to: '/creator/products' })
        },
        800,
      )
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
            <Button
              type='submit'
              variant='primary'
              isLoading={submitting && submitStatusRef.current === 'published'}
              disabled={submitting}
              onClick={() => {
                submitStatusRef.current = 'published'
              }}
            >
              <Plus size={16} aria-hidden='true' />
              {m.product_action_publish()}
            </Button>
            <Button
              type='submit'
              variant='secondary'
              isLoading={submitting && submitStatusRef.current === 'draft'}
              disabled={submitting}
              onClick={() => {
                submitStatusRef.current = 'draft'
              }}
            >
              {m.product_action_save_draft()}
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
