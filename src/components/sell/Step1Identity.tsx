import { useCallback, useEffect, useRef, useState } from 'react'
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

export function Step1Identity() {
  const { draft, saveStep, getStepData } = useOnboarding()
  const data = getStepData(1) as {
    name: string
    slug: string
    tagline: string
    category: string
    productionType: string
  }

  const [name, setName] = useState(data.name ?? '')
  const [slug, setSlug] = useState(data.slug ?? '')
  const [tagline, setTagline] = useState(data.tagline ?? '')
  const [category, setCategory] = useState(data.category ?? '')
  const [productionType, setProductionType] = useState(data.productionType ?? '')

  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [nameWarning, setNameWarning] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const slugDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const slugManuallyEdited = useRef(!!data.slug && data.slug !== slugify(data.name))

  const checkSlug = useCallback(
    async (value: string) => {
      if (!value || value.length < 3) {
        setSlugStatus('idle')
        return
      }
      setSlugStatus('checking')
      try {
        const result = await checkSlugAvailability({
          data: { slug: value, excludeShopId: draft.id },
        })
        setSlugStatus(result.available ? 'available' : 'taken')
        if (!result.available && !slugManuallyEdited.current) {
          const alt = suggestSlug(name)
          setSlug(alt)
          const altResult = await checkSlugAvailability({
            data: { slug: alt, excludeShopId: draft.id },
          })
          setSlugStatus(altResult.available ? 'available' : 'taken')
        }
      } catch {
        setSlugStatus('idle')
      }
    },
    [draft.id, name],
  )

  useEffect(() => {
    if (!slugManuallyEdited.current && name.length >= 4) {
      const generated = slugify(name)
      setSlug(generated)
      checkSlug(generated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, checkSlug])

  const handleSlugChange = (value: string) => {
    slugManuallyEdited.current = true
    setSlug(value)
    clearTimeout(slugDebounce.current)
    if (value.length >= 3) {
      slugDebounce.current = setTimeout(() => checkSlug(value), 300)
    } else {
      setSlugStatus('idle')
    }
  }

  const handleNameBlur = async () => {
    if (name.length < 4) return
    try {
      const result = await checkShopName({ data: { name, excludeShopId: draft.id } })
      if (result.profanity) {
        setNameWarning('Please avoid inappropriate language in your shop name.')
      } else if (result.similarExists) {
        setNameWarning(`'${name}' is very close to an existing shop — consider a more unique name.`)
      } else {
        setNameWarning(null)
      }
    } catch {
      // ignore
    }
  }

  const validate = useCallback(() => {
    const result = step1IdentitySchema.safeParse({ name, slug, tagline, category, productionType })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string
        fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return false
    }
    setErrors({})
    return true
  }, [name, slug, tagline, category, productionType])

  const save = useCallback(async () => {
    await saveStep(1, { name, slug, tagline, category, productionType })
  }, [name, slug, tagline, category, productionType, saveStep])

  useStepActions(1, { validate, save })

  const productionLabels: Record<string, string> = {
    handmade: 'Handmade by me',
    vintage: 'Vintage (20+ years old)',
    supplies: 'Craft supplies',
    digital: 'Digital downloads',
    mixed: 'A mix',
  }

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
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          maxLength={40}
          placeholder='e.g. Sunflower Ceramics'
          className='mt-1'
          error={errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <p id='name-error' className='mt-1 text-sm text-error'>
            {errors.name}
          </p>
        )}
        {nameWarning && !errors.name && (
          <p className='mt-1 flex items-center gap-1 text-sm text-warning'>
            <AlertTriangle size={14} />
            {nameWarning}
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
          <span className='shrink-0 text-sm text-text-muted'>eurtisan.com/shop/</span>
          <Input
            id='shop-slug'
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            maxLength={40}
            placeholder='my-shop'
            className='font-mono'
            error={errors.slug}
            aria-describedby={errors.slug ? 'slug-error' : undefined}
          />
        </div>
        {errors.slug && (
          <p id='slug-error' className='mt-1 text-sm text-error'>
            {errors.slug}
          </p>
        )}
        <div className='mt-1 flex items-center gap-2 text-sm'>
          {slugStatus === 'checking' && (
            <span className='flex items-center gap-1 text-text-muted'>
              <Loader2 size={14} className='animate-spin' />
              Checking…
            </span>
          )}
          {slugStatus === 'available' && (
            <span className='flex items-center gap-1 text-success'>
              <Check size={14} />
              Available
            </span>
          )}
          {slugStatus === 'taken' && (
            <span className='text-error'>This URL is already taken — try another</span>
          )}
        </div>
      </div>

      {/* Tagline */}
      <div>
        <Label htmlFor='shop-tagline'>Tagline</Label>
        <Input
          id='shop-tagline'
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={80}
          placeholder='A short one-liner that describes your shop'
          className='mt-1'
        />
        <p className='mt-1 text-right text-xs text-text-muted'>{tagline.length}/80</p>
      </div>

      {/* Category */}
      <div>
        <Label htmlFor='shop-category' required>
          Primary category
        </Label>
        <Select
          id='shop-category'
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className='mt-1'
          error={errors.category}
        >
          <option value=''>Select a category</option>
          {SHOP_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </option>
          ))}
        </Select>
        {errors.category && <p className='mt-1 text-sm text-error'>{errors.category}</p>}
      </div>

      {/* Production Type */}
      <div>
        <Label required>Production type</Label>
        <div className='mt-2 grid gap-3 sm:grid-cols-2'>
          {PRODUCTION_TYPES.map((type) => {
            const isSelected = productionType === type
            return (
              <button
                key={type}
                type='button'
                onClick={() => setProductionType(type)}
                className={`flex items-center justify-between rounded-xl border-2 p-4 text-left shadow-sm transition-all duration-base ease-out hover:scale-[1.01] hover:shadow-md ${
                  isSelected
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-border-default hover:border-accent-secondary bg-surface-default'
                }`}
              >
                <span className='font-medium text-text-primary'>{productionLabels[type]}</span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-base ${
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
        {errors.productionType && (
          <p className='mt-2 text-sm text-error'>{errors.productionType}</p>
        )}
      </div>
    </div>
  )
}
