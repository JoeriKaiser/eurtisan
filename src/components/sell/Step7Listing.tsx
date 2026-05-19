import { useCallback, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { createDraftListing, step7ListingSchema } from '#/lib/sell-onboarding'
import { formatPriceEUR } from '#/lib/pricing'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

function ImageUpload({
  images,
  onChange,
}: {
  images: { dataUrl: string; altText?: string }[]
  onChange: (images: { dataUrl: string; altText?: string }[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      onChange([...images, { dataUrl }])
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <div className='grid grid-cols-3 gap-2 sm:grid-cols-5'>
        {images.map((img, i) => (
          <div key={img.dataUrl.slice(0, 20)} className='relative aspect-square'>
            <img
              src={img.dataUrl}
              alt={`Item ${i + 1}`}
              className='h-full w-full rounded-lg object-cover'
            />
            {i === 0 && (
              <span className='absolute left-1 top-1 rounded bg-accent-primary px-1.5 py-0.5 text-xs text-on-primary'>
                Cover
              </span>
            )}
            <button
              type='button'
              onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              className='absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error text-on-primary transition hover:bg-error-hover'
              aria-label='Remove image'
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {images.length < 5 && (
          <button
            type='button'
            onClick={() => inputRef.current?.click()}
            className='flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border-default bg-surface-default aspect-square transition hover:border-accent-secondary'
          >
            <ImagePlus size={20} className='text-text-muted' />
            <span className='mt-1 text-xs text-text-muted'>Add</span>
            <input
              ref={inputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp'
              className='hidden'
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0])
              }}
            />
          </button>
        )}
      </div>
    </div>
  )
}

export function Step7Listing() {
  const { draft, saveStep } = useOnboarding()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priceCents, setPriceCents] = useState('')
  const [stockCount, setStockCount] = useState('1')
  const [images, setImages] = useState<{ dataUrl: string; altText?: string }[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const priceValue = Number.parseInt(priceCents, 10) || 0
  const platformFee = Math.round(priceValue * 0.03)
  const paymentFee = Math.round(priceValue * 0.035 + 30)
  const net = priceValue - platformFee - paymentFee

  const validate = useCallback(() => {
    const result = step7ListingSchema.safeParse({
      name,
      description,
      priceCents: priceValue,
      stockCount: Number.parseInt(stockCount, 10) || 0,
      images,
    })
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
  }, [name, description, priceValue, stockCount, images])

  const save = useCallback(async () => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 100)

    await createDraftListing({
      data: {
        draftId: draft.id,
        name,
        description,
        priceCents: priceValue,
        stockCount: Number.parseInt(stockCount, 10) || 1,
        images,
        slug,
      },
    })

    await saveStep(7, {})
  }, [draft.id, name, description, priceValue, stockCount, images, saveStep])

  useStepActions(7, { validate, save })

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='display-title text-2xl text-text-primary'>Your First Listing</h2>
        <p className='mt-1 text-text-secondary'>Every great shop starts with a great listing.</p>
      </div>

      <div className='rounded-lg border border-accent-secondary/20 bg-accent-secondary-subtle/30 p-3 text-sm text-accent-secondary'>
        This listing will be published when your shop is approved.
      </div>

      {/* Photos */}
      <div>
        <Label required>Photos</Label>
        <div className='mt-1'>
          <ImageUpload images={images} onChange={setImages} />
        </div>
        {errors.images && <p className='mt-1 text-sm text-error'>{errors.images}</p>}
      </div>

      {/* Title */}
      <div>
        <Label htmlFor='listing-name' required>
          Title
        </Label>
        <Input
          id='listing-name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={140}
          placeholder='What are you selling?'
          className='mt-1'
        />
        {errors.name && <p className='mt-1 text-sm text-error'>{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor='listing-desc' required>
          Description
        </Label>
        <Textarea
          id='listing-desc'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder='Describe your item...'
          className='mt-1'
        />
        {errors.description && <p className='mt-1 text-sm text-error'>{errors.description}</p>}
      </div>

      {/* Price */}
      <div>
        <Label htmlFor='listing-price' required>
          Price
        </Label>
        <div className='mt-1 flex items-center gap-2'>
          <span className='text-text-muted'>€</span>
          <Input
            id='listing-price'
            type='number'
            min={0}
            step='0.01'
            value={priceCents ? (priceValue / 100).toFixed(2) : ''}
            onChange={(e) => {
              const val = Number.parseFloat(e.target.value)
              setPriceCents(Number.isNaN(val) ? '' : String(Math.round(val * 100)))
            }}
            placeholder='0.00'
          />
        </div>
        {priceValue > 0 && (
          <div className='mt-2 space-y-1 rounded-lg bg-surface-inset p-3 text-sm text-text-secondary'>
            <div className='flex justify-between'>
              <span>You enter</span>
              <span>{formatPriceEUR(priceValue)}</span>
            </div>
            <div className='flex justify-between'>
              <span>Platform fee (3%)</span>
              <span className='text-error'>− {formatPriceEUR(platformFee)}</span>
            </div>
            <div className='flex justify-between'>
              <span>Payment fee (3.5% + €0.30)</span>
              <span className='text-error'>− {formatPriceEUR(paymentFee)}</span>
            </div>
            <div className='flex justify-between font-medium text-text-primary'>
              <span>You receive</span>
              <span>≈ {formatPriceEUR(net)}</span>
            </div>
          </div>
        )}
        {errors.priceCents && <p className='mt-1 text-sm text-error'>{errors.priceCents}</p>}
      </div>

      {/* Quantity */}
      <div>
        <Label htmlFor='listing-stock'>Quantity</Label>
        <Input
          id='listing-stock'
          type='number'
          min={1}
          value={stockCount}
          onChange={(e) => setStockCount(e.target.value)}
          className='mt-1 w-32'
        />
      </div>
    </div>
  )
}
