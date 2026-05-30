import { useRouter } from '@tanstack/react-router'
import { Check, Save, Trash2, X } from 'lucide-react'
import { useCallback, useReducer, useRef, useState } from 'react'
import type { CreatorShop } from '#/lib/creator-dashboard'
import { deleteProduct, updateProduct } from '#/lib/creator-products'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { CancelConfirmationDialog } from './CancelConfirmationDialog'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'
import { ProductEditImageUploader } from './ProductEditImageUploader'
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
  images: ProductImageRecord[]
}

export interface ExistingImageEntry {
  type: 'existing'
  id: string
  url: string
  altText: string
  sortOrder: number
}

export interface NewImageEntry {
  type: 'new'
  id: string
  file: File
  dataUrl: string
  altText: string
  reading: boolean
  error: string | null
}

interface FeedbackState {
  type: 'success' | 'error'
  message: string
}

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
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
/*                              Image reducer                                 */
/* -------------------------------------------------------------------------- */

interface ImageState {
  existing: ExistingImageEntry[]
  new: NewImageEntry[]
}

type ImageAction =
  | { type: 'moveUp'; id: string }
  | { type: 'moveDown'; id: string }
  | { type: 'removeExisting'; id: string }
  | { type: 'addNew'; images: NewImageEntry[] }
  | { type: 'updateNew'; id: string; updates: Partial<NewImageEntry> }
  | { type: 'removeNew'; id: string }
  | { type: 'reset'; product: ProductDetail }

function createInitialImageState(product: ProductDetail): ImageState {
  return {
    existing: product.images.map((img) => ({
      type: 'existing' as const,
      id: img.id,
      url: img.url,
      altText: img.altText ?? '',
      sortOrder: img.sortOrder,
    })),
    new: [],
  }
}

function imageReducer(state: ImageState, action: ImageAction): ImageState {
  switch (action.type) {
    case 'moveUp': {
      const idx = state.existing.findIndex((img) => img.id === action.id)
      if (idx <= 0) return state
      const next = [...state.existing]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return { ...state, existing: next.map((img, i) => ({ ...img, sortOrder: i })) }
    }
    case 'moveDown': {
      const idx = state.existing.findIndex((img) => img.id === action.id)
      if (idx < 0 || idx >= state.existing.length - 1) return state
      const next = [...state.existing]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return { ...state, existing: next.map((img, i) => ({ ...img, sortOrder: i })) }
    }
    case 'removeExisting':
      return {
        ...state,
        existing: state.existing.reduce<ExistingImageEntry[]>((acc, img) => {
          if (img.id !== action.id) {
            acc.push({ ...img, sortOrder: acc.length })
          }
          return acc
        }, []),
      }
    case 'addNew':
      return { ...state, new: [...state.new, ...action.images] }
    case 'updateNew':
      return {
        ...state,
        new: state.new.map((img) => (img.id === action.id ? { ...img, ...action.updates } : img)),
      }
    case 'removeNew':
      return { ...state, new: state.new.filter((img) => img.id !== action.id) }
    case 'reset':
      return createInitialImageState(action.product)
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
  const [imageState, dispatchImage] = useReducer(imageReducer, product, createInitialImageState)

  const slugManuallyEditedRef = useRef(true)
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const originalState = {
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    price: (product.priceCents / 100).toFixed(2),
    stockCount: String(product.stockCount),
    categoryId: product.categoryId ?? '',
    isActive: product.isActive,
    vatRateCategory: product.vatRateCategory ?? 'standard',
    existingImageOrder: product.images.map((i) => i.id).join(','),
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
    imageState.existing.map((i) => i.id).join(',') !== originalState.existingImageOrder ||
    imageState.new.length > 0

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

  /* ----------------------- Existing image reordering ----------------------- */

  const moveImageUp = (imageId: string) => {
    dispatchImage({ type: 'moveUp', id: imageId })
  }

  const moveImageDown = (imageId: string) => {
    dispatchImage({ type: 'moveDown', id: imageId })
  }

  const handleRemoveExistingImage = (imageId: string) => {
    dispatchImage({ type: 'removeExisting', id: imageId })
  }

  /* -------------------------- New image handling --------------------------- */

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

  const totalImages = imageState.existing.length + imageState.new.length

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const remaining = MAX_IMAGES - totalImages
    if (remaining <= 0) {
      dispatchForm({
        type: 'mergeFieldErrors',
        errors: { images: m.creator_product_new_images_error_max() },
      })
      return
    }

    const filesToAdd = Array.from(files).slice(0, remaining)

    const placeholders: NewImageEntry[] = filesToAdd.map((file) => ({
      type: 'new',
      id: crypto.randomUUID(),
      file,
      dataUrl: '',
      altText: '',
      reading: true,
      error: null,
    }))

    dispatchImage({ type: 'addNew', images: placeholders })
    dispatchForm({ type: 'clearFieldError', field: 'images' })

    const results = await Promise.all(
      placeholders.map(async (placeholder) => {
        if (!ALLOWED_IMAGE_TYPES.has(placeholder.file.type)) {
          return { id: placeholder.id, error: m.creator_product_new_images_error_type() }
        }

        if (placeholder.file.size > MAX_IMAGE_SIZE) {
          return { id: placeholder.id, error: m.creator_product_new_images_error_size() }
        }

        try {
          const dataUrl = await readFileAsDataUrl(placeholder.file)
          return { id: placeholder.id, dataUrl, error: null }
        } catch {
          return { id: placeholder.id, error: m.creator_product_new_images_error_type() }
        }
      }),
    )

    for (const result of results) {
      dispatchImage({
        type: 'updateNew',
        id: result.id,
        updates: {
          dataUrl: result.dataUrl ?? '',
          error: result.error,
          reading: false,
        },
      })
    }

    const input = document.getElementById('product-image-upload') as HTMLInputElement
    if (input) input.value = ''
  }

  const handleRemoveNewImage = (imageId: string) => {
    dispatchImage({ type: 'removeNew', id: imageId })
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

    const erroredNewImages = imageState.new.filter((img) => img.error)
    if (erroredNewImages.length > 0) {
      errors.images = m.creator_product_new_images_error_type()
    }

    dispatchForm({ type: 'setFieldErrors', errors })
    return Object.keys(errors).length === 0
  }, [formState.values, formState.slugError, imageState.new])

  /* ---------------------------- Form submission ---------------------------- */

  const urlToDataUrl = useCallback(async (url: string): Promise<string> => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read image blob'))
      reader.readAsDataURL(blob)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    if (!validateForm()) return

    setSubmitting(true)

    try {
      const priceCents = Math.round(Number.parseFloat(formState.values.price) * 100)

      const imagePayload: Array<{ dataUrl: string; altText?: string }> = []

      try {
        const existingDataUrls = await Promise.all(
          imageState.existing.map(async (img) => {
            const dataUrl = await urlToDataUrl(img.url)
            return { dataUrl, altText: img.altText || undefined }
          }),
        )
        imagePayload.push(...existingDataUrls)
      } catch {
        setFeedback({
          type: 'error',
          message: m.creator_product_edit_image_fetch_error(),
        })
        setSubmitting(false)
        return
      }

      for (const img of imageState.new) {
        if (!img.error && img.dataUrl) {
          imagePayload.push({
            dataUrl: img.dataUrl,
            altText: img.altText || undefined,
          })
        }
      }

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
          images: imagePayload.length > 0 ? imagePayload : undefined,
        },
      })

      setFeedback({
        type: 'success',
        message: m.creator_product_edit_save_success(),
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
          setFeedback({
            type: 'error',
            message: m.creator_product_edit_save_error(),
          })
        }
      } else {
        setFeedback({
          type: 'error',
          message: m.creator_product_edit_save_error(),
        })
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

  /* --------------------------- Delete handling ---------------------------- */

  const handleDelete = async () => {
    setDeleting(true)
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
      setFeedback({
        type: 'error',
        message: m.creator_product_edit_delete_error(),
      })
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
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
            onClick={() => setShowDeleteConfirm(true)}
            disabled={submitting || deleting}
          >
            <Trash2 size={16} aria-hidden='true' />
            <span className='hidden sm:inline'>{m.creator_product_edit_delete_button()}</span>
          </Button>
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
              existingImages={imageState.existing}
              newImages={imageState.new}
              maxImages={MAX_IMAGES}
              fieldError={formState.fieldErrors.images}
              onImageSelect={handleImageSelect}
              onRemoveExisting={handleRemoveExistingImage}
              onRemoveNew={handleRemoveNewImage}
              onMoveUp={moveImageUp}
              onMoveDown={moveImageDown}
            />
          </div>

          {/* Submit */}
          <div className='mt-8 flex items-center gap-4 border-t border-border-subtle pt-6'>
            <Button type='submit' variant='primary' isLoading={submitting} disabled={submitting}>
              <Save size={16} aria-hidden='true' />
              {submitting ? m.creator_product_edit_saving() : m.creator_product_edit_save()}
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

      <DeleteConfirmationDialog
        open={showDeleteConfirm}
        title={m.creator_product_edit_delete_confirm_title()}
        description={m.creator_product_edit_delete_confirm_description()}
        cancelLabel={m.creator_product_edit_delete_confirm_cancel()}
        confirmLabel={m.creator_product_edit_delete_confirm_button()}
        deleting={deleting}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </main>
  )
}
