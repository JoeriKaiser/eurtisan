import { Check, X } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { Input } from '#/components/ui/input'

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

interface ShopSettingsFormFieldsProps {
  values: FormValues
  nameError: string | null
  slugError: string | null
  descriptionError: string | null
  slugChecking: boolean
  slugAvailable: boolean | null
  onNameChange: (value: string) => void
  onSlugChange: (value: string) => void
  onDescriptionChange: (value: string) => void
}

export function ShopSettingsFormFields({
  values,
  nameError,
  slugError,
  descriptionError,
  slugChecking,
  slugAvailable,
  onNameChange,
  onSlugChange,
  onDescriptionChange,
}: ShopSettingsFormFieldsProps) {
  return (
    <>
      {/* Shop name */}
      <div>
        <label htmlFor='shop-name' className='mb-2 block text-sm font-medium text-text-primary'>
          {m.creator_shop_name_label()}
        </label>
        <Input
          id='shop-name'
          type='text'
          value={values.name}
          onChange={(e) => onNameChange(e.target.value)}
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
        <label htmlFor='shop-slug' className='mb-2 block text-sm font-medium text-text-primary'>
          {m.creator_shop_slug_label()}
        </label>
        <div className='relative'>
          <Input
            id='shop-slug'
            type='text'
            value={values.slug}
            onChange={(e) => {
              const val = e.target.value.toLowerCase().replace(/\s+/g, '-')
              onSlugChange(val)
            }}
            error={slugError ? slugError : undefined}
            placeholder={m.creator_shop_slug_placeholder()}
            maxLength={100}
            required
          />
          {slugChecking && (
            <span className='absolute right-3 top-1/2 -translate-y-1/2'>
              <svg
                className='size-4 animate-spin text-text-muted'
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
          value={values.description}
          onChange={(e) => onDescriptionChange(e.target.value)}
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
          <p className='text-xs text-text-muted ml-auto'>{values.description.length}/2000</p>
        </div>
      </div>
    </>
  )
}
