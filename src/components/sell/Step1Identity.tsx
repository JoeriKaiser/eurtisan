import { AlertTriangle, Check, ImagePlus, Loader2, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useImageUpload } from '#/hooks/useImageUpload'
import { getImageUrl } from '#/lib/image-url'
import {
  PRODUCTION_TYPES,
  SHOP_CATEGORIES,
  checkShopName,
  checkSlugAvailability,
  slugify,
  step1IdentitySchema,
} from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

const categoryLabels: Record<(typeof SHOP_CATEGORIES)[number], () => string> = {
  jewelry_accessories: () => m.onboarding_category_jewelry_accessories(),
  home_living: () => m.onboarding_category_home_living(),
  art_collectibles: () => m.onboarding_category_art_collectibles(),
  clothing: () => m.onboarding_category_clothing(),
  craft_supplies: () => m.onboarding_category_craft_supplies(),
  vintage: () => m.onboarding_category_vintage(),
  other: () => m.onboarding_category_other(),
}

const productionLabels: Record<(typeof PRODUCTION_TYPES)[number], () => string> = {
  handmade: () => m.onboarding_production_handmade(),
  vintage: () => m.onboarding_production_vintage(),
  supplies: () => m.onboarding_production_supplies(),
  mixed: () => m.onboarding_production_mixed(),
}

const starterPrompts = [
  () => m.onboarding_story_prompt_specialises(),
  () => m.onboarding_story_prompt_process(),
  () => m.onboarding_story_prompt_started(),
]

interface ProfileData {
  name: string
  slug: string
  tagline: string
  category: string
  productionType: string
  description: string
  hasProductionPartner: boolean
  productionPartnerDetails: string
  image: string
}

function focusFirstError(errors: Record<string, string>) {
  const firstField = Object.keys(errors)[0]
  const fieldIds: Record<string, string> = {
    name: 'shop-name',
    slug: 'shop-slug',
    category: 'shop-category',
    productionType: 'production-handmade',
    description: 'shop-description',
    image: 'shop-image-upload',
  }
  const id = fieldIds[firstField]
  if (id) document.getElementById(id)?.focus()
}

export function Step1Identity() {
  const { draft, saveStep, getStepData, updateField, updateFields } = useOnboarding()
  const form = getStepData(1) as unknown as ProfileData
  const [status, setStatus] = useState({
    slugStatus: 'idle' as 'idle' | 'checking' | 'available' | 'taken',
    nameWarning: null as string | null,
    errors: {} as Record<string, string>,
  })
  const slugDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const slugManuallyEdited = useRef(Boolean(form.slug && form.slug !== slugify(form.name)))
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, uploading, error: uploadError } = useImageUpload({ onboardingDraftId: draft.id })

  const checkSlug = useCallback(
    async (value: string) => {
      if (!value || value.length < 3) {
        setStatus((previous) => ({ ...previous, slugStatus: 'idle' }))
        return
      }
      setStatus((previous) => ({ ...previous, slugStatus: 'checking' }))
      try {
        const result = await checkSlugAvailability({
          data: { slug: value, excludeShopId: draft.id },
        })
        setStatus((previous) => {
          const errors = { ...previous.errors }
          if (result.available) delete errors.slug
          else errors.slug = m.onboarding_slug_taken()
          return {
            ...previous,
            errors,
            slugStatus: result.available ? 'available' : 'taken',
          }
        })
      } catch {
        setStatus((previous) => ({ ...previous, slugStatus: 'idle' }))
      }
    },
    [draft.id],
  )

  const handleNameChange = (value: string) => {
    const fields: Record<string, unknown> = { name: value }
    if (!slugManuallyEdited.current && value.length >= 2) fields.slug = slugify(value)
    updateFields(1, fields)
    if (typeof fields.slug === 'string') void checkSlug(fields.slug)
  }

  const handleSlugChange = (value: string) => {
    slugManuallyEdited.current = true
    const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    updateField(1, 'slug', normalized)
    clearTimeout(slugDebounce.current)
    if (normalized.length >= 3) {
      slugDebounce.current = setTimeout(() => void checkSlug(normalized), 300)
    } else {
      setStatus((previous) => ({ ...previous, slugStatus: 'idle' }))
    }
  }

  const handleNameBlur = async () => {
    if (form.name.length < 4) return
    try {
      const result = await checkShopName({ data: { name: form.name, excludeShopId: draft.id } })
      setStatus((previous) => ({
        ...previous,
        nameWarning: result.profanity
          ? m.onboarding_name_inappropriate()
          : result.similarExists
            ? m.onboarding_name_similar()
            : null,
      }))
    } catch {
      setStatus((previous) => ({ ...previous, nameWarning: null }))
    }
  }

  const handleImage = async (file: File) => {
    const result = await upload(file, 'shops')
    if (result) updateField(1, 'image', result.key)
  }

  const validate = useCallback(() => {
    const result = step1IdentitySchema.safeParse(form)
    const errors: Record<string, string> = {}
    if (!result.success) {
      for (const issue of result.error.issues) errors[String(issue.path[0])] = issue.message
    }
    if (status.slugStatus === 'taken') errors.slug = m.onboarding_slug_taken()
    setStatus((previous) => ({ ...previous, errors }))
    if (Object.keys(errors).length > 0) focusFirstError(errors)
    return Object.keys(errors).length === 0
  }, [form, status.slugStatus])

  const save = useCallback(async () => {
    const availability = await checkSlugAvailability({
      data: { slug: form.slug, excludeShopId: draft.id },
    })
    if (!availability.available) {
      setStatus((previous) => ({
        ...previous,
        slugStatus: 'taken',
        errors: { ...previous.errors, slug: m.onboarding_slug_taken() },
      }))
      document.getElementById('shop-slug')?.focus()
      throw new Error('SLUG_TAKEN')
    }
    await saveStep(1, form as unknown as Record<string, unknown>)
  }, [draft.id, form, saveStep])
  const stepActionsRef = useStepActions(1, { validate, save })
  const previewUrl = form.image ? getImageUrl(form.image) : ''

  return (
    <div ref={stepActionsRef} className='space-y-8'>
      <header>
        <p className='text-sm font-medium text-accent-primary'>{m.onboarding_time_estimate()}</p>
        <h1 className='display-title mt-1 text-2xl text-text-primary'>
          {m.onboarding_profile_title()}
        </h1>
        <p className='mt-2 max-w-[65ch] text-text-secondary'>
          {m.onboarding_profile_description()}
        </p>
      </header>

      <section
        className='rounded-xl border border-border-default bg-surface-inset p-4'
        aria-labelledby='prepare-title'
      >
        <h2 id='prepare-title' className='font-semibold text-text-primary'>
          {m.onboarding_prepare_title()}
        </h2>
        <ul className='mt-3 grid gap-2 text-sm text-text-secondary sm:grid-cols-2'>
          <li className='flex gap-2'>
            <Check className='mt-0.5 size-4 shrink-0 text-success' aria-hidden='true' />
            {m.onboarding_prepare_icon()}
          </li>
          <li className='flex gap-2'>
            <Check className='mt-0.5 size-4 shrink-0 text-success' aria-hidden='true' />
            {m.onboarding_prepare_tax()}
          </li>
          <li className='flex gap-2'>
            <Check className='mt-0.5 size-4 shrink-0 text-success' aria-hidden='true' />
            {m.onboarding_prepare_product()}
          </li>
          <li className='flex gap-2'>
            <Check className='mt-0.5 size-4 shrink-0 text-success' aria-hidden='true' />
            {m.onboarding_prepare_launch()}
          </li>
        </ul>
        <p className='mt-3 text-xs text-text-muted'>{m.onboarding_prepare_fees()}</p>
      </section>

      <section className='space-y-6' aria-labelledby='identity-title'>
        <h2 id='identity-title' className='text-lg font-semibold text-text-primary'>
          {m.onboarding_identity_title()}
        </h2>

        <div>
          <Label htmlFor='shop-name' required>
            {m.onboarding_shop_name()}
          </Label>
          <Input
            id='shop-name'
            value={form.name}
            onChange={(event) => handleNameChange(event.target.value)}
            onBlur={() => void handleNameBlur()}
            maxLength={40}
            placeholder={m.onboarding_shop_name_placeholder()}
            className='mt-1'
            error={status.errors.name}
          />
          {status.errors.name ? (
            <p id='shop-name-error' className='mt-1 text-sm text-error'>
              {status.errors.name}
            </p>
          ) : status.nameWarning ? (
            <p className='mt-1 flex items-center gap-1 text-sm text-warning'>
              <AlertTriangle size={14} aria-hidden='true' />
              {status.nameWarning}
            </p>
          ) : (
            <p className='mt-1 text-xs text-text-muted'>{m.onboarding_shop_name_hint()}</p>
          )}
        </div>

        <div>
          <Label htmlFor='shop-slug' required>
            {m.onboarding_shop_url()}
          </Label>
          <div className='mt-1 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center'>
            <span className='text-sm text-text-muted'>eurtisan.eu/shops/</span>
            <Input
              id='shop-slug'
              value={form.slug}
              onChange={(event) => handleSlugChange(event.target.value)}
              maxLength={40}
              placeholder={m.onboarding_shop_url_placeholder()}
              className='font-mono'
              error={status.errors.slug}
            />
          </div>
          {status.errors.slug && (
            <p id='shop-slug-error' className='mt-1 text-sm text-error'>
              {status.errors.slug}
            </p>
          )}
          <div className='mt-1 min-h-5 text-sm' aria-live='polite'>
            {status.slugStatus === 'checking' && (
              <span className='flex items-center gap-1 text-text-muted'>
                <Loader2 size={14} className='animate-spin' aria-hidden='true' />
                {m.onboarding_slug_checking()}
              </span>
            )}
            {status.slugStatus === 'available' && (
              <span className='flex items-center gap-1 text-success'>
                <Check size={14} aria-hidden='true' />
                {m.onboarding_slug_available()}
              </span>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor='shop-tagline'>{m.onboarding_tagline()}</Label>
          <Input
            id='shop-tagline'
            value={form.tagline}
            onChange={(event) => updateField(1, 'tagline', event.target.value)}
            maxLength={80}
            placeholder={m.onboarding_tagline_placeholder()}
            className='mt-1'
          />
          <p className='mt-1 text-right text-xs text-text-muted'>{form.tagline.length}/80</p>
        </div>

        <div>
          <Label htmlFor='shop-category' required>
            {m.onboarding_primary_category()}
          </Label>
          <Select
            id='shop-category'
            value={form.category}
            onChange={(event) => updateField(1, 'category', event.target.value)}
            className='mt-1'
            error={status.errors.category}
          >
            <option value=''>{m.onboarding_category_placeholder()}</option>
            {SHOP_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]()}
              </option>
            ))}
          </Select>
          {status.errors.category && (
            <p id='shop-category-error' className='mt-1 text-sm text-error'>
              {status.errors.category}
            </p>
          )}
        </div>

        <fieldset>
          <legend className='text-sm font-medium text-text-primary'>
            {m.onboarding_production_type()}{' '}
            <span className='text-error' aria-hidden='true'>
              *
            </span>
          </legend>
          <div className='mt-2 grid gap-3 sm:grid-cols-2'>
            {PRODUCTION_TYPES.map((type) => (
              <label
                key={type}
                className={`flex min-h-14 cursor-pointer items-center justify-between rounded-xl border-2 p-4 transition-colors duration-fast ease-out focus-within:ring-2 focus-within:ring-accent-secondary focus-within:ring-offset-2 ${form.productionType === type ? 'border-accent-primary bg-accent-primary/10' : 'border-border-default bg-surface-default hover:border-border-strong'}`}
              >
                <span className='font-medium text-text-primary'>{productionLabels[type]()}</span>
                <input
                  id={`production-${type}`}
                  type='radio'
                  name='production-type'
                  value={type}
                  checked={form.productionType === type}
                  onChange={() => updateField(1, 'productionType', type)}
                  className='size-5 accent-[var(--ds-accent-primary)]'
                />
              </label>
            ))}
          </div>
          {status.errors.productionType && (
            <p id='production-type-error' className='mt-2 text-sm text-error'>
              {status.errors.productionType}
            </p>
          )}
        </fieldset>
      </section>

      <section
        className='space-y-5 border-t border-border-default pt-8'
        aria-labelledby='story-title'
      >
        <div>
          <h2 id='story-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_story_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary'>{m.onboarding_story_description()}</p>
        </div>
        <div>
          <Label htmlFor='shop-description' required>
            {m.onboarding_shop_story()}
          </Label>
          <div className='my-2 flex flex-wrap gap-2'>
            {starterPrompts.map((prompt) => {
              const text = prompt()
              return (
                <button
                  key={text}
                  type='button'
                  onClick={() =>
                    updateField(
                      1,
                      'description',
                      form.description ? `${form.description}\n\n${text}` : text,
                    )
                  }
                  className='min-h-11 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-secondary transition-colors hover:border-accent-primary hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
                >
                  {text}
                </button>
              )
            })}
          </div>
          <Textarea
            id='shop-description'
            value={form.description}
            onChange={(event) => updateField(1, 'description', event.target.value)}
            rows={7}
            maxLength={5000}
            placeholder={m.onboarding_story_placeholder()}
            error={status.errors.description}
          />
          <div className='mt-1 flex justify-between gap-4 text-xs'>
            <span id='shop-description-error' className='text-error'>
              {status.errors.description}
            </span>
            <span className='ml-auto text-text-muted'>{form.description.length}/5000</span>
          </div>
        </div>

        <div className='rounded-xl border border-border-default p-4'>
          <label
            className='flex min-h-11 cursor-pointer items-center justify-between gap-4'
            htmlFor='production-partner'
          >
            <span>
              <span className='block text-sm font-medium text-text-primary'>
                {m.onboarding_production_partner()}
              </span>
              <span className='mt-1 block text-xs text-text-muted'>
                {m.onboarding_production_partner_hint()}
              </span>
            </span>
            <input
              id='production-partner'
              type='checkbox'
              checked={form.hasProductionPartner}
              onChange={(event) => updateField(1, 'hasProductionPartner', event.target.checked)}
              className='size-5 accent-[var(--ds-accent-primary)]'
            />
          </label>
          {form.hasProductionPartner && (
            <div className='mt-4'>
              <Label htmlFor='partner-details'>{m.onboarding_partner_details()}</Label>
              <Input
                id='partner-details'
                value={form.productionPartnerDetails}
                onChange={(event) => updateField(1, 'productionPartnerDetails', event.target.value)}
                maxLength={500}
                placeholder={m.onboarding_partner_placeholder()}
                className='mt-1'
              />
            </div>
          )}
        </div>
      </section>

      <section
        className='space-y-4 border-t border-border-default pt-8'
        aria-labelledby='visual-title'
      >
        <div>
          <h2 id='visual-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_visual_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary'>{m.onboarding_visual_description()}</p>
        </div>
        <Label htmlFor='shop-image-upload' required>
          {m.onboarding_shop_icon()}
        </Label>
        {form.image ? (
          <div className='grid gap-4 rounded-xl border border-border-default bg-surface-inset p-4 sm:grid-cols-[8rem_1fr] sm:items-center'>
            <div className='relative size-28'>
              <img
                src={previewUrl}
                alt={m.onboarding_shop_icon_preview_alt()}
                className='size-28 rounded-xl object-cover'
              />
              <button
                type='button'
                onClick={() => updateField(1, 'image', '')}
                className='absolute -right-2 -top-2 flex size-11 items-center justify-center rounded-full bg-error text-text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
                aria-label={m.onboarding_remove_shop_icon()}
              >
                <X size={16} aria-hidden='true' />
              </button>
            </div>
            <div>
              <p className='text-sm font-semibold text-text-primary'>
                {form.name || m.onboarding_untitled_shop()}
              </p>
              <p className='mt-1 font-mono text-xs text-text-muted'>
                eurtisan.eu/shops/{form.slug || m.onboarding_shop_url_placeholder()}
              </p>
              <p className='mt-3 text-sm text-text-secondary'>{m.onboarding_icon_preview_hint()}</p>
            </div>
          </div>
        ) : (
          <button
            type='button'
            onClick={() => inputRef.current?.click()}
            className='flex min-h-36 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-default bg-surface-default p-6 text-center transition-colors hover:border-accent-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
            aria-describedby='shop-image-help'
          >
            <ImagePlus size={28} className='mb-2 text-text-muted' aria-hidden='true' />
            <span className='text-sm font-medium text-text-primary'>
              {uploading ? m.onboarding_uploading_image() : m.onboarding_upload_shop_icon()}
            </span>
            <span id='shop-image-help' className='mt-1 text-xs text-text-muted'>
              {m.onboarding_image_requirements()}
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          id='shop-image-upload'
          type='file'
          accept='image/jpeg,image/png,image/webp'
          className='sr-only'
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleImage(file)
          }}
        />
        {(status.errors.image || uploadError) && (
          <p id='shop-image-upload-error' className='text-sm text-error'>
            {status.errors.image ?? uploadError}
          </p>
        )}
      </section>
    </div>
  )
}
