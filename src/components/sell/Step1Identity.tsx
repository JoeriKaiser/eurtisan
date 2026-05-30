import { useCallback, useRef, useState } from 'react'
import { Check, AlertTriangle, Loader2 } from 'lucide-react'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import {
  PRODUCTION_TYPES,
  SHOP_CATEGORIES,
  checkShopName,
  checkSlugAvailability,
  slugify,
  suggestSlug,
  step1IdentitySchema,
} from '#/lib/sell-onboarding'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

const productionLabels: Record<string, string> = {
  handmade: 'Handmade by me',
  vintage: 'Vintage (20+ years old)',
  supplies: 'Craft supplies',
  digital: 'Digital downloads',
  mixed: 'A mix',
}

export function Step1Identity() {
  const { draft, saveStep, getStepData } = useOnboarding()
  const data = getStepData(1) as {
    name: string
    slug: string
    tagline: string
    category: string
    productionType: string
  }

  const [form, setForm] = useState({
    name: data.name ?? '',
    slug: data.slug ?? '',
    tagline: data.tagline ?? '',
    category: data.category ?? '',
    productionType: data.productionType ?? '',
  })
  const [status, setStatus] = useState({
    slugStatus: 'idle' as 'idle' | 'checking' | 'available' | 'taken',
    nameWarning: null as string | null,
    errors: {} as Record<string, string>,
  })
  const slugDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const slugManuallyEdited = useRef(!!data.slug && data.slug !== slugify(data.name))

  const checkSlug = useCallback(
    async (value: string) => {
      if (!value || value.length < 3) {
        setStatus((prev) => ({ ...prev, slugStatus: 'idle' }))
        return
      }
      setStatus((prev) => ({ ...prev, slugStatus: 'checking' }))
      try {
        const result = await checkSlugAvailability({
          data: { slug: value, excludeShopId: draft.id },
        })
        if (!result.available && !slugManuallyEdited.current) {
          const alt = suggestSlug(form.name)
          setForm((prev) => ({ ...prev, slug: alt }))
          const altResult = await checkSlugAvailability({
            data: { slug: alt, excludeShopId: draft.id },
          })
          setStatus((prev) => ({
            ...prev,
            slugStatus: altResult.available ? 'available' : 'taken',
          }))
        } else {
          setStatus((prev) => ({ ...prev, slugStatus: result.available ? 'available' : 'taken' }))
        }
      } catch {
        setStatus((prev) => ({ ...prev, slugStatus: 'idle' }))
      }
    },
    [draft.id, form.name],
  )

  const handleNameChange = (value: string) => {
    setForm((prev) => ({ ...prev, name: value }))
    if (!slugManuallyEdited.current && value.length >= 4) {
      const generated = slugify(value)
      setForm((prev) => ({ ...prev, slug: generated }))
      checkSlug(generated)
    }
  }

  const handleSlugChange = (value: string) => {
    slugManuallyEdited.current = true
    setForm((prev) => ({ ...prev, slug: value }))
    clearTimeout(slugDebounce.current)
    if (value.length >= 3) {
      slugDebounce.current = setTimeout(() => checkSlug(value), 300)
    } else {
      setStatus((prev) => ({ ...prev, slugStatus: 'idle' }))
    }
  }

  const handleNameBlur = async () => {
    if (form.name.length < 4) return
    try {
      const result = await checkShopName({ data: { name: form.name, excludeShopId: draft.id } })
      if (result.profanity) {
        setStatus((prev) => ({
          ...prev,
          nameWarning: 'Please avoid inappropriate language in your shop name.',
        }))
      } else if (result.similarExists) {
        setStatus((prev) => ({
          ...prev,
          nameWarning: `'${form.name}' is very close to an existing shop. Consider a more unique name.`,
        }))
      } else {
        setStatus((prev) => ({ ...prev, nameWarning: null }))
      }
    } catch {
      // ignore
    }
  }

  const validate = useCallback(() => {
    const result = step1IdentitySchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string
        fieldErrors[key] = issue.message
      }
      setStatus((prev) => ({ ...prev, errors: fieldErrors }))
      return false
    }
    setStatus((prev) => ({ ...prev, errors: {} }))
    return true
  }, [form])

  const save = useCallback(async () => {
    await saveStep(1, form)
  }, [form, saveStep])

  useStepActions(1, { validate, save })

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='display-title text-2xl text-text-primary'>Let's start with the basics</h2>
        <p className='mt-1 text-text-secondary'>
          Your shop identity is how buyers will find and remember you.
        </p>
      </div>

      {/* Name */}
      <div>
        <Label htmlFor='shop-name' required>
          Shop name
        </Label>
        <Input
          id='shop-name'
          value={form.name}
          onChange={(e) => handleNameChange(e.target.value)}
          onBlur={handleNameBlur}
          maxLength={40}
          placeholder='e.g. Sunflower Ceramics'
          className='mt-1'
          error={status.errors.name}
          aria-describedby={status.errors.name ? 'name-error' : undefined}
        />
        {status.errors.name && (
          <p id='name-error' className='mt-1 text-sm text-error'>
            {status.errors.name}
          </p>
        )}
        {status.nameWarning && !status.errors.name && (
          <p className='mt-1 flex items-center gap-1 text-sm text-warning'>
            <AlertTriangle size={14} />
            {status.nameWarning}
          </p>
        )}
        <p className='mt-1 text-xs text-text-muted'>
          4–40 characters. Letters, numbers, spaces, and hyphens only.
        </p>
      </div>

      {/* Slug */}
      <div>
        <Label htmlFor='shop-slug' required>
          Shop URL
        </Label>
        <div className='mt-1 flex items-center gap-2'>
          <span className='shrink-0 text-sm text-text-muted'>eurtisan.eu/shop/</span>
          <Input
            id='shop-slug'
            value={form.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            maxLength={40}
            placeholder='my-shop'
            className='font-mono'
            error={status.errors.slug}
            aria-describedby={status.errors.slug ? 'slug-error' : undefined}
          />
        </div>
        {status.errors.slug && (
          <p id='slug-error' className='mt-1 text-sm text-error'>
            {status.errors.slug}
          </p>
        )}
        <div className='mt-1 flex items-center gap-2 text-sm'>
          {status.slugStatus === 'checking' && (
            <span className='flex items-center gap-1 text-text-muted'>
              <Loader2 size={14} className='animate-spin' />
              Checking…
            </span>
          )}
          {status.slugStatus === 'available' && (
            <span className='flex items-center gap-1 text-success'>
              <Check size={14} />
              Available
            </span>
          )}
          {status.slugStatus === 'taken' && (
            <span className='text-error'>This URL is already taken. Try another</span>
          )}
        </div>
      </div>

      {/* Tagline */}
      <div>
        <Label htmlFor='shop-tagline'>Tagline</Label>
        <Input
          id='shop-tagline'
          value={form.tagline}
          onChange={(e) => setForm((prev) => ({ ...prev, tagline: e.target.value }))}
          maxLength={80}
          placeholder='A short one-liner that describes your shop'
          className='mt-1'
        />
        <p className='mt-1 text-right text-xs text-text-muted'>{form.tagline.length}/80</p>
      </div>

      {/* Category */}
      <div>
        <Label htmlFor='shop-category' required>
          Primary category
        </Label>
        <Select
          id='shop-category'
          value={form.category}
          onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          className='mt-1'
          error={status.errors.category}
        >
          <option value=''>Select a category</option>
          {SHOP_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </option>
          ))}
        </Select>
        {status.errors.category && (
          <p className='mt-1 text-sm text-error'>{status.errors.category}</p>
        )}
      </div>

      {/* Production Type */}
      <div>
        <Label required>Production type</Label>
        <div className='mt-2 grid gap-3 sm:grid-cols-2'>
          {PRODUCTION_TYPES.map((type) => {
            const isSelected = form.productionType === type
            return (
              <button
                key={type}
                type='button'
                onClick={() => setForm((prev) => ({ ...prev, productionType: type }))}
                className={`flex items-center justify-between rounded-xl border-2 p-4 text-left shadow-sm transition-all duration-base ease-out hover:scale-[1.01] hover:shadow-md ${
                  isSelected
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-border-default hover:border-accent-secondary bg-surface-default'
                }`}
              >
                <span className='font-medium text-text-primary'>{productionLabels[type]}</span>
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-base ${
                    isSelected
                      ? 'border-accent-primary bg-accent-primary text-text-on-primary scale-110 shadow-sm'
                      : 'border-border-strong bg-surface-elevated'
                  }`}
                >
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>
        {status.errors.productionType && (
          <p className='mt-2 text-sm text-error'>{status.errors.productionType}</p>
        )}
      </div>
    </div>
  )
}
