import { useLoaderData } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, ImagePlus, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useImageUpload } from '#/hooks/useImageUpload'
import { isUnitPricingScoped } from '#/lib/products/unit-pricing'
import { getImageUrl } from '#/lib/image-url'
import { PLATFORM_FEE_PERCENT } from '#/lib/platform-constants'
import { formatPriceEUR, parseEuroToCents } from '#/lib/pricing'
import { saveDraftListing, slugify, step7ListingSchema } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

interface ListingImage {
  key: string
  altText?: string
}

interface ListingData {
  productId?: string
  name: string
  slug: string
  description: string
  price: string
  stockCount: string
  categoryId: string
  vatRateCategory: 'standard' | 'reduced' | 'exempt'
  weightGrams: string
  lengthCm: string
  widthCm: string
  heightCm: string
  soldBy: '' | 'weight' | 'volume'
  volumeMl: string
  images: ListingImage[]
}

function focusFirstError(errors: Record<string, string>) {
  const fieldMap: Record<string, string> = {
    images: 'listing-images-upload',
    name: 'listing-name',
    description: 'listing-description',
    priceCents: 'listing-price',
    stockCount: 'listing-stock',
    categoryId: 'listing-category',
    vatRateCategory: 'listing-vat-category',
    weightGrams: 'listing-weight',
    lengthCm: 'listing-length',
    widthCm: 'listing-width',
    heightCm: 'listing-height',
  }
  const id = fieldMap[Object.keys(errors)[0]]
  if (id) document.getElementById(id)?.focus()
}

export function Step7Listing() {
  const { categories } = useLoaderData({ from: '/sell/onboarding/$draftId' })
  const { draft, getStepData, updateField, updateFields, runSave } = useOnboarding()
  const form = getStepData(3) as unknown as ListingData
  const [errors, setErrors] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, uploading, error: uploadError } = useImageUpload({ onboardingDraftId: draft.id })

  const priceCents = parseEuroToCents(form.price) ?? 0
  // Matches the backend payout formula (fee on the sale subtotal); VAT on the
  // fee base is not yet known at listing time.
  const platformFee = Math.round(priceCents * (PLATFORM_FEE_PERCENT / 100))
  const net = Math.max(0, priceCents - platformFee)

  const handleNameChange = (name: string) => {
    updateFields(3, {
      name,
      slug: form.productId && form.slug ? form.slug : slugify(name),
    })
  }

  const handleFiles = async (files: File[]) => {
    const available = Math.max(0, 5 - form.images.length)
    const results = await Promise.all(
      files.slice(0, available).map((file) => upload(file, 'products')),
    )
    const added = results
      .filter((result): result is NonNullable<typeof result> => Boolean(result))
      .map((result) => ({ key: result.key }))
    if (added.length > 0) updateField(3, 'images', [...form.images, ...added])
  }

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= form.images.length) return
    const images = [...form.images]
    const [image] = images.splice(index, 1)
    images.splice(target, 0, image)
    updateField(3, 'images', images)
  }

  const validate = useCallback(() => {
    const result = step7ListingSchema.safeParse({
      productId: form.productId,
      name: form.name,
      description: form.description,
      priceCents,
      stockCount: Number.parseInt(form.stockCount, 10),
      categoryId: form.categoryId,
      vatRateCategory: form.vatRateCategory,
      weightGrams: Number.parseInt(form.weightGrams, 10),
      lengthCm: Number.parseInt(form.lengthCm, 10),
      widthCm: Number.parseInt(form.widthCm, 10),
      heightCm: Number.parseInt(form.heightCm, 10),
      soldBy: form.soldBy || undefined,
      volumeMl: form.volumeMl ? Number.parseInt(form.volumeMl, 10) : undefined,
      images: form.images,
    })
    if (result.success) {
      setErrors({})
      return true
    }
    const nextErrors: Record<string, string> = {}
    for (const issue of result.error.issues) nextErrors[String(issue.path[0])] = issue.message
    setErrors(nextErrors)
    focusFirstError(nextErrors)
    return false
  }, [form, priceCents])

  const save = useCallback(async () => {
    await runSave(() =>
      saveDraftListing({
        data: {
          draftId: draft.id,
          productId: form.productId,
          name: form.name,
          description: form.description,
          slug: form.slug || slugify(form.name),
          priceCents,
          stockCount: Number.parseInt(form.stockCount, 10),
          categoryId: form.categoryId,
          vatRateCategory: form.vatRateCategory,
          weightGrams: Number.parseInt(form.weightGrams, 10),
          lengthCm: Number.parseInt(form.lengthCm, 10),
          widthCm: Number.parseInt(form.widthCm, 10),
          heightCm: Number.parseInt(form.heightCm, 10),
          soldBy: form.soldBy || undefined,
          volumeMl: form.volumeMl ? Number.parseInt(form.volumeMl, 10) : undefined,
          images: form.images,
        },
      }),
    )
  }, [draft.id, form, priceCents, runSave])

  const stepActionsRef = useStepActions(3, { validate, save })

  return (
    <div ref={stepActionsRef} className='space-y-8'>
      <header>
        <p className='text-sm font-medium text-accent-primary'>{m.onboarding_stage_product()}</p>
        <h1 className='display-title mt-1 text-2xl text-text-primary'>
          {m.onboarding_product_title()}
        </h1>
        <p className='mt-2 max-w-[65ch] text-text-secondary'>
          {m.onboarding_product_description()}
        </p>
      </header>

      <section className='space-y-5' aria-labelledby='product-details-title'>
        <h2 id='product-details-title' className='text-lg font-semibold text-text-primary'>
          {m.onboarding_product_details()}
        </h2>
        <div>
          <Label htmlFor='listing-name' required>
            {m.onboarding_product_name()}
          </Label>
          <Input
            id='listing-name'
            value={form.name}
            onChange={(event) => handleNameChange(event.target.value)}
            maxLength={140}
            placeholder={m.onboarding_product_name_placeholder()}
            className='mt-1'
            error={errors.name}
          />
          {errors.name && (
            <p id='listing-name-error' className='mt-1 text-sm text-error'>
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor='listing-description' required>
            {m.onboarding_product_description_label()}
          </Label>
          <Textarea
            id='listing-description'
            value={form.description}
            onChange={(event) => updateField(3, 'description', event.target.value)}
            rows={6}
            maxLength={2000}
            placeholder={m.onboarding_product_description_placeholder()}
            className='mt-1'
            error={errors.description}
          />
          {errors.description && (
            <p id='listing-description-error' className='mt-1 text-sm text-error'>
              {errors.description}
            </p>
          )}
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div>
            <Label htmlFor='listing-category' required>
              {m.onboarding_product_category()}
            </Label>
            <Select
              id='listing-category'
              value={form.categoryId}
              onChange={(event) => updateField(3, 'categoryId', event.target.value)}
              className='mt-1'
              error={errors.categoryId}
            >
              <option value=''>{m.onboarding_product_category_placeholder()}</option>
              {categories.map((category: { id: string; name: string }) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            {errors.categoryId && (
              <p id='listing-category-error' className='mt-1 text-sm text-error'>
                {errors.categoryId}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor='listing-vat-category' required>
              {m.vat_category_label()}
            </Label>
            <Select
              id='listing-vat-category'
              value={form.vatRateCategory}
              onChange={(event) => updateField(3, 'vatRateCategory', event.target.value)}
              className='mt-1'
              error={errors.vatRateCategory}
            >
              <option value='standard'>{m.vat_category_standard()}</option>
              <option value='reduced'>{m.vat_category_reduced()}</option>
              <option value='exempt'>{m.vat_category_exempt()}</option>
            </Select>
            <p className='mt-1 text-xs text-text-muted'>{m.vat_category_hint()}</p>
          </div>
        </div>
      </section>

      <section
        className='space-y-4 border-t border-border-default pt-8'
        aria-labelledby='photos-title'
      >
        <div>
          <h2 id='photos-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_product_photos()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary'>{m.onboarding_product_photos_hint()}</p>
        </div>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
          {form.images.map((image, index) => (
            <div
              key={image.key}
              className='space-y-2 rounded-xl border border-border-default bg-surface-default p-2'
            >
              <div className='relative aspect-square'>
                <img
                  src={getImageUrl(image.key)}
                  alt={
                    image.altText || m.onboarding_product_image_alt({ index: String(index + 1) })
                  }
                  className='size-full rounded-lg object-cover'
                />
                {index === 0 && (
                  <span className='absolute left-2 top-2 rounded-md bg-accent-primary px-2 py-1 text-xs font-medium text-text-on-primary'>
                    {m.onboarding_cover_image()}
                  </span>
                )}
                <button
                  type='button'
                  onClick={() =>
                    updateField(
                      3,
                      'images',
                      form.images.filter((_, imageIndex) => imageIndex !== index),
                    )
                  }
                  className='absolute right-1 top-1 flex size-11 items-center justify-center rounded-full bg-error text-text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
                  aria-label={m.onboarding_remove_product_image({ index: String(index + 1) })}
                >
                  <X size={16} aria-hidden='true' />
                </button>
              </div>
              <Input
                value={image.altText ?? ''}
                onChange={(event) =>
                  updateField(
                    3,
                    'images',
                    form.images.map((item, imageIndex) =>
                      imageIndex === index ? { ...item, altText: event.target.value } : item,
                    ),
                  )
                }
                placeholder={m.onboarding_image_alt_placeholder()}
                aria-label={m.onboarding_image_alt_label({ index: String(index + 1) })}
                maxLength={500}
              />
              <div className='flex justify-between'>
                <button
                  type='button'
                  onClick={() => moveImage(index, -1)}
                  disabled={index === 0}
                  className='flex size-11 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-inset disabled:opacity-30'
                  aria-label={m.onboarding_move_image_left()}
                >
                  <ArrowLeft size={16} aria-hidden='true' />
                </button>
                <button
                  type='button'
                  onClick={() => moveImage(index, 1)}
                  disabled={index === form.images.length - 1}
                  className='flex size-11 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-inset disabled:opacity-30'
                  aria-label={m.onboarding_move_image_right()}
                >
                  <ArrowRight size={16} aria-hidden='true' />
                </button>
              </div>
            </div>
          ))}
          {form.images.length < 5 && (
            <button
              id='listing-images-upload'
              type='button'
              onClick={() => inputRef.current?.click()}
              className='flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-default bg-surface-default p-4 text-center hover:border-accent-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
            >
              <ImagePlus size={24} className='text-text-muted' aria-hidden='true' />
              <span className='mt-2 text-sm font-medium text-text-primary'>
                {uploading ? m.onboarding_uploading_image() : m.onboarding_add_product_photos()}
              </span>
              <span className='mt-1 text-xs text-text-muted'>
                {m.onboarding_image_requirements()}
              </span>
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type='file'
          accept='image/jpeg,image/png,image/webp'
          multiple
          className='sr-only'
          onChange={(event) => void handleFiles(Array.from(event.target.files ?? []))}
        />
        {(errors.images || uploadError) && (
          <p id='listing-images-upload-error' className='text-sm text-error'>
            {errors.images ?? uploadError}
          </p>
        )}
      </section>

      <section
        className='space-y-5 border-t border-border-default pt-8'
        aria-labelledby='sale-title'
      >
        <h2 id='sale-title' className='text-lg font-semibold text-text-primary'>
          {m.onboarding_sale_details()}
        </h2>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div>
            <Label htmlFor='listing-price' required>
              {m.onboarding_product_price()}
            </Label>
            <div className='mt-1 flex items-center gap-2'>
              <span className='text-text-muted' aria-hidden='true'>
                {m.currency_symbol()}
              </span>
              <Input
                id='listing-price'
                type='number'
                min='0.50'
                step='0.01'
                inputMode='decimal'
                value={form.price}
                onChange={(event) => updateField(3, 'price', event.target.value)}
                error={errors.priceCents}
              />
            </div>
            {errors.priceCents && (
              <p id='listing-price-error' className='mt-1 text-sm text-error'>
                {errors.priceCents}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor='listing-stock' required>
              {m.onboarding_product_quantity()}
            </Label>
            <Input
              id='listing-stock'
              type='number'
              min={1}
              step={1}
              inputMode='numeric'
              value={form.stockCount}
              onChange={(event) => updateField(3, 'stockCount', event.target.value)}
              className='mt-1'
              error={errors.stockCount}
            />
            {errors.stockCount && (
              <p id='listing-stock-error' className='mt-1 text-sm text-error'>
                {errors.stockCount}
              </p>
            )}
          </div>
        </div>
        {priceCents > 0 && (
          <div className='space-y-2 rounded-xl bg-surface-inset p-4 text-sm text-text-secondary'>
            <div className='flex justify-between'>
              <span>{m.onboarding_price_entered()}</span>
              <span>{formatPriceEUR(priceCents)}</span>
            </div>
            <div className='flex justify-between'>
              <span>{m.onboarding_platform_fee({ percent: PLATFORM_FEE_PERCENT })}</span>
              <span>− {formatPriceEUR(platformFee)}</span>
            </div>
            <div className='flex justify-between border-t border-border-default pt-2 font-semibold text-text-primary'>
              <span>{m.onboarding_estimated_earnings()}</span>
              <span>{formatPriceEUR(net)}</span>
            </div>
          </div>
        )}
      </section>

      <section
        className='space-y-5 border-t border-border-default pt-8'
        aria-labelledby='parcel-title'
      >
        <div>
          <h2 id='parcel-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_parcel_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary'>{m.onboarding_parcel_description()}</p>
        </div>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <div>
            <Label htmlFor='listing-weight' required>
              {m.product_weight_label()}
            </Label>
            <Input
              id='listing-weight'
              type='number'
              min={1}
              inputMode='numeric'
              value={form.weightGrams}
              onChange={(event) => updateField(3, 'weightGrams', event.target.value)}
              className='mt-1'
              error={errors.weightGrams}
            />
          </div>
          <div>
            <Label htmlFor='listing-length' required>
              {m.product_length_label()}
            </Label>
            <Input
              id='listing-length'
              type='number'
              min={1}
              inputMode='numeric'
              value={form.lengthCm}
              onChange={(event) => updateField(3, 'lengthCm', event.target.value)}
              className='mt-1'
              error={errors.lengthCm}
            />
          </div>
          <div>
            <Label htmlFor='listing-width' required>
              {m.product_width_label()}
            </Label>
            <Input
              id='listing-width'
              type='number'
              min={1}
              inputMode='numeric'
              value={form.widthCm}
              onChange={(event) => updateField(3, 'widthCm', event.target.value)}
              className='mt-1'
              error={errors.widthCm}
            />
          </div>
          <div>
            <Label htmlFor='listing-height' required>
              {m.product_height_label()}
            </Label>
            <Input
              id='listing-height'
              type='number'
              min={1}
              inputMode='numeric'
              value={form.heightCm}
              onChange={(event) => updateField(3, 'heightCm', event.target.value)}
              className='mt-1'
              error={errors.heightCm}
            />
          </div>
        </div>
        {['weightGrams', 'lengthCm', 'widthCm', 'heightCm'].map((field) =>
          errors[field] ? (
            <p key={field} className='text-sm text-error'>
              {errors[field]}
            </p>
          ) : null,
        )}
        {isUnitPricingScoped([
          categories.find(
            (category: { id: string; slug?: string }) => category.id === form.categoryId,
          )?.slug ?? null,
        ]) && (
          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <Label htmlFor='listing-sold-by'>{m.unit_price_sold_by_label()}</Label>
              <select
                id='listing-sold-by'
                value={form.soldBy}
                onChange={(event) => updateField(3, 'soldBy', event.target.value)}
                className='mt-1 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none'
              >
                <option value=''>{m.creator_product_new_category_none()}</option>
                <option value='weight'>{m.unit_price_basis_weight()}</option>
                <option value='volume'>{m.unit_price_basis_volume()}</option>
              </select>
            </div>
            <div>
              <Label htmlFor='listing-volume-ml'>{m.unit_price_volume_label()}</Label>
              <Input
                id='listing-volume-ml'
                type='number'
                min={1}
                inputMode='numeric'
                value={form.volumeMl}
                onChange={(event) => updateField(3, 'volumeMl', event.target.value)}
                className='mt-1'
                error={errors.volumeMl}
              />
            </div>
            <p className='text-xs text-text-muted sm:col-span-2'>{m.unit_price_hint()}</p>
          </div>
        )}
      </section>
    </div>
  )
}
