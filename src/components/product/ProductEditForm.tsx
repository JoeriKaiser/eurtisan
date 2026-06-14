import { useRouter } from '@tanstack/react-router'
import { Save, Trash2 } from 'lucide-react'
import { useCallback, useReducer, useRef, useState } from 'react'
import type { CreatorShop } from '#/lib/creator-dashboard'
import { deleteProduct, updateProduct } from '#/lib/creator-products'
import { useImageUpload } from '#/hooks/useImageUpload'
import { getImageUrl } from '#/lib/image-url'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import { CancelConfirmationDialog } from './CancelConfirmationDialog'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'
import { ProductEditImageUploader, type ImageEntry } from './ProductEditImageUploader'
import { ProductEditFormFields } from './ProductEditFormFields'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface ProductImageRecord {
  id: string
  url: string
  altText: string | null
  sortOrder: number
}

interface ProductDetail {
  id: string
  name: string
  description: string | null
  slug: string
  priceCents: number
  stockCount: number
  isActive: boolean
  vatRateCategory: string
  shopId: string
  categoryId: string | null
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  images: ProductImageRecord[]
}

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
  | { type: 'reset'; product: ProductDetail }

function createInitialFormState(product: ProductDetail): FormState {
  return {
    values: {
      shopId: product.shopId,
      name: product.name,
      slug: product.slug,
      description: product.description ?? '',
      price: (product.priceCents / 100).toFixed(2),
      stockCount: String(product.stockCount),
      categoryId: product.categoryId ?? '',
      isActive: product.isActive,
      vatRateCategory: (product.vatRateCategory as 'standard' | 'reduced' | 'exempt') ?? 'standard',
      weightGrams: product.weightGrams != null ? String(product.weightGrams) : '',
      lengthCm: product.lengthCm != null ? String(product.lengthCm) : '',
      widthCm: product.widthCm != null ? String(product.widthCm) : '',
      heightCm: product.heightCm != null ? String(product.heightCm) : '',
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
      return createInitialFormState(action.product)
    default:
      return state
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

interface ProductEditFormProps {
  shops: CreatorShop[]
  categories: Array<{ id: string; name: string; slug: string }>
  product: ProductDetail
}

export function ProductEditForm({ shops, categories, product }: ProductEditFormProps) {
  const router = useRouter()

  const [formState, dispatchForm] = useReducer(formReducer, product, createInitialFormState)
  const [images, setImages] = useState<ImageEntry[]>(
    product.images.map((img) => ({
      id: img.id,
      key: img.url,
      previewUrl: getImageUrl(img.url),
      altText: img.altText ?? '',
      sortOrder: img.sortOrder,
      isNew: false,
    })),
  )

  const slugManuallyEditedRef = useRef(true)
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [submissionState, setSubmissionState] = useState<{
    submitting: boolean
    feedback: FeedbackState | null
  }>({ submitting: false, feedback: null })
  const [deleteState, setDeleteState] = useState<{ showDialog: boolean; deleting: boolean }>({
    showDialog: false,
    deleting: false,
  })
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const { uploadMultiple, error: uploadError } = useImageUpload()

  const originalState = {
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    price: (product.priceCents / 100).toFixed(2),
    stockCount: String(product.stockCount),
    categoryId: product.categoryId ?? '',
    isActive: product.isActive,
    vatRateCategory: product.vatRateCategory ?? 'standard',
    weightGrams: product.weightGrams != null ? String(product.weightGrams) : '',
    lengthCm: product.lengthCm != null ? String(product.lengthCm) : '',
    widthCm: product.widthCm != null ? String(product.widthCm) : '',
    heightCm: product.heightCm != null ? String(product.heightCm) : '',
    imageOrder: product.images.map((i) => i.id).join(','),
  }

  const hasChanges =
    formState.values.name !== originalState.name ||
    formState.values.slug !== originalState.slug ||
    formState.values.description !== originalState.description ||
    formState.values.price !== originalState.price ||
    formState.values.stockCount !== originalState.stockCount ||
    formState.values.categoryId !== originalState.categoryId ||
    formState.values.isActive !== originalState.isActive ||
    formState.values.vatRateCategory !== originalState.vatRateCategory ||
    formState.values.weightGrams !== originalState.weightGrams ||
    formState.values.lengthCm !== originalState.lengthCm ||
    formState.values.widthCm !== originalState.widthCm ||
    formState.values.heightCm !== originalState.heightCm ||
    images.map((i) => i.id).join(',') !== originalState.imageOrder ||
    images.some((i) => i.isNew)

  /* ------------------------ Slug auto-generation --------------------------- */

  const validateSlugDebounced = useCallback((value: string) => {
    if (slugTimerRef.current) {
      clearTimeout(slugTimerRef.current)
    }

    slugTimerRef.current = setTimeout(() => {
      dispatchForm({
        type: 'setSlugError',
        error: !value
          ? null
          : !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
            ? m.creator_product_new_slug_format_error()
            : null,
      })
    }, SLUG_DEBOUNCE_MS)
  }, [])

  const handleNameChange = (value: string) => {
    dispatchForm({ type: 'setField', field: 'name', value })
    if (!slugManuallyEditedRef.current) {
      const autoSlug = generateSlug(value)
      dispatchForm({ type: 'setField', field: 'slug', value: autoSlug })
      validateSlugDebounced(autoSlug)
    }
  }

  const handleSlugChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/\s+/g, '-')
    dispatchForm({ type: 'setField', field: 'slug', value: cleaned })
    slugManuallyEditedRef.current = true
    validateSlugDebounced(cleaned)
  }

  /* ----------------------- Image handling ----------------------- */

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

      const placeholders: ImageEntry[] = filesToAdd.map((file) => ({
        id: crypto.randomUUID(),
        key: '',
        previewUrl: URL.createObjectURL(file),
        altText: '',
        sortOrder: images.length,
        isNew: true,
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
    setImages((prev) =>
      prev.filter((img) => img.id !== imageId).map((img, i) => ({ ...img, sortOrder: i })),
    )
  }

  const moveImageUp = (imageId: string) => {
    setImages((prev) => {
      const idx = prev.findIndex((img) => img.id === imageId)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next.map((img, i) => ({ ...img, sortOrder: i }))
    })
  }

  const moveImageDown = (imageId: string) => {
    setImages((prev) => {
      const idx = prev.findIndex((img) => img.id === imageId)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next.map((img, i) => ({ ...img, sortOrder: i }))
    })
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
    setSubmissionState({ submitting: true, feedback: null })

    if (!validateForm()) {
      setSubmissionState({ submitting: false, feedback: null })
      return
    }

    try {
      const priceCents = Math.round(Number.parseFloat(formState.values.price) * 100)

      await updateProduct({
        data: {
          productId: product.id,
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
          widthCm: formState.values.widthCm
            ? Number.parseInt(formState.values.widthCm, 10)
            : undefined,
          heightCm: formState.values.heightCm
            ? Number.parseInt(formState.values.heightCm, 10)
            : undefined,
          images: images
            .filter((img) => !img.error && !img.uploading && img.key)
            .map((img) => ({ key: img.key, altText: img.altText || undefined })),
        },
      })

      setSubmissionState({
        submitting: false,
        feedback: {
          type: 'success',
          message: m.creator_product_edit_save_success(),
        },
      })
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
          setSubmissionState({
            submitting: false,
            feedback: {
              type: 'error',
              message: m.creator_product_edit_save_error(),
            },
          })
        }
      } else {
        setSubmissionState({
          submitting: false,
          feedback: {
            type: 'error',
            message: m.creator_product_edit_save_error(),
          },
        })
      }
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

  /* --------------------------- Delete handling ---------------------------- */

  const handleDelete = async () => {
    setDeleteState({ showDialog: true, deleting: true })
    try {
      await deleteProduct({
        data: {
          productId: product.id,
          shopId: product.shopId,
          hard: false,
        },
      })
      router.navigate({ to: '/creator/products' })
    } catch {
      setSubmissionState({
        submitting: false,
        feedback: {
          type: 'error',
          message: m.creator_product_edit_delete_error(),
        },
      })
      setDeleteState({ showDialog: false, deleting: false })
    }
  }

  /* ------------------------------ Render ----------------------------------- */

  return (
    <main className='page-wrap px-4 py-8 sm:py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        {/* Header */}
        <div className='mb-8 flex items-start justify-between gap-4'>
          <div>
            <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
              {m.creator_product_edit_title()}
            </h1>
            <p className='text-text-secondary'>{m.creator_product_edit_description()}</p>
          </div>
          <Button
            type='button'
            variant='danger'
            size='sm'
            onClick={() => setDeleteState({ showDialog: true, deleting: false })}
            disabled={submissionState.submitting || deleteState.deleting}
          >
            <Trash2 size={16} aria-hidden='true' />
            <span className='hidden sm:inline'>{m.creator_product_edit_delete_button()}</span>
          </Button>
        </div>

        {/* Feedback banner */}
        {submissionState.feedback && (
          <FeedbackBanner
            type={submissionState.feedback.type}
            message={submissionState.feedback.message}
          />
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className='grid gap-8 lg:grid-cols-3'>
            <ProductEditFormFields
              shops={shops}
              categories={categories}
              values={formState.values}
              fieldErrors={formState.fieldErrors}
              slugError={formState.slugError}
              onNameChange={handleNameChange}
              onSlugChange={handleSlugChange}
              onFieldChange={(field, value) => dispatchForm({ type: 'setField', field, value })}
            />

            <ProductEditImageUploader
              images={images}
              maxImages={MAX_IMAGES}
              fieldError={formState.fieldErrors.images}
              onImageSelect={handleImageSelect}
              onRemoveImage={handleRemoveImage}
              onMoveUp={moveImageUp}
              onMoveDown={moveImageDown}
            />
          </div>

          {/* Submit */}
          <div className='mt-8 flex items-center gap-4 border-t border-border-subtle pt-6'>
            <Button
              type='submit'
              variant='primary'
              isLoading={submissionState.submitting}
              disabled={submissionState.submitting}
            >
              <Save size={16} aria-hidden='true' />
              {submissionState.submitting
                ? m.creator_product_edit_saving()
                : m.creator_product_edit_save()}
            </Button>
            <Button
              type='button'
              variant='ghost'
              onClick={handleCancel}
              disabled={submissionState.submitting}
            >
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

      <DeleteConfirmationDialog
        open={deleteState.showDialog}
        title={m.creator_product_edit_delete_confirm_title()}
        description={m.creator_product_edit_delete_confirm_description()}
        cancelLabel={m.creator_product_edit_delete_confirm_cancel()}
        confirmLabel={m.creator_product_edit_delete_confirm_button()}
        deleting={deleteState.deleting}
        onCancel={() => setDeleteState({ showDialog: false, deleting: false })}
        onConfirm={handleDelete}
      />
    </main>
  )
}
