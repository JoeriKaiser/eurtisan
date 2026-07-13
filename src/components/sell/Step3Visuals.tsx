import { ImagePlus, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useImageUpload } from '#/hooks/useImageUpload'
import { getImageUrl } from '#/lib/image-url'
import { Label } from '../ui/label'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

function ImageUploader({
  label,
  required,
  value,
  onChange,
  recommendedSize,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (url: string) => void
  recommendedSize?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const { upload, error: uploadError } = useImageUpload()

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setIsUploading(true)
    try {
      const result = await upload(file, 'shops')
      if (result) {
        onChange(result.key)
      }
    } catch {
      // error handled by upload hook
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const previewUrl = value ? getImageUrl(value) : ''

  return (
    <div>
      <Label htmlFor={`upload-${label}`}>
        {label}
        {required ? <span className='text-error'> *</span> : null}
        {recommendedSize ? <span className='text-text-muted'> ({recommendedSize})</span> : null}
      </Label>

      {value ? (
        <div className='relative mt-1 inline-block'>
          <img
            src={previewUrl}
            alt={label}
            className={`rounded-lg object-cover shadow-md border border-border-default ${label.includes('Banner') ? 'h-40 w-full' : 'size-32'}`}
          />
          <button
            type='button'
            onClick={() => onChange('')}
            className='absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-error text-text-on-primary shadow-md transition duration-fast hover:scale-115 hover:bg-error-hover'
            aria-label='Remove image'
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type='button'
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          aria-label={label}
          className='mt-1 flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-default bg-surface-default p-8 shadow-sm transition-all duration-base ease-out hover:scale-[1.005] hover:border-accent-secondary hover:bg-accent-secondary/[0.03] hover:shadow-md'
        >
          {isUploading ? (
            <span className='text-sm text-text-muted'>Uploading…</span>
          ) : (
            <>
              <ImagePlus
                size={32}
                className='mb-2 text-text-muted transition-transform duration-base group-hover:scale-110'
              />
              <span className='text-sm text-text-secondary'>Drag & drop or click to upload</span>
            </>
          )}
          <input
            id={`upload-${label}`}
            ref={inputRef}
            type='file'
            accept='image/jpeg,image/png,image/webp'
            aria-label={label}
            className='hidden'
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0])
            }}
          />
        </button>
      )}

      {uploadError && <p className='mt-1 text-sm text-error'>{uploadError}</p>}
    </div>
  )
}

export function Step3Visuals() {
  const { saveStep, getStepData } = useOnboarding()
  const data = getStepData(3) as { image: string; bannerImage: string }

  const [image, setImage] = useState(data.image ?? '')
  const [bannerImage, setBannerImage] = useState(data.bannerImage ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = useCallback(() => {
    if (!image) {
      setErrors({ image: 'Shop icon is required' })
      return false
    }
    setErrors({})
    return true
  }, [image])

  const save = useCallback(async () => {
    await saveStep(3, { image, bannerImage })
  }, [image, bannerImage, saveStep])

  const stepActionsRef = useStepActions(3, { validate, save })

  return (
    <div ref={stepActionsRef} className='space-y-6'>
      <div>
        <h2 className='display-title text-2xl text-text-primary'>Visual Identity</h2>
        <p className='mt-1 text-text-secondary'>
          First impressions matter. Upload images that represent your shop.
        </p>
      </div>

      <ImageUploader
        label='Shop icon'
        required
        value={image}
        onChange={setImage}
        recommendedSize='400×400px min'
      />
      {errors.image && <p className='mt-1 text-sm text-error'>{errors.image}</p>}

      <ImageUploader
        label='Banner image'
        value={bannerImage}
        onChange={setBannerImage}
        recommendedSize='1200×300px recommended'
      />
    </div>
  )
}
