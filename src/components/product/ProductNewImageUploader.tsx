import { useId } from 'react'
import { ImageIcon, Upload, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export interface UploadedImage {
  id: string
  key: string
  previewUrl: string
  altText: string
  uploading: boolean
  error: string | null
}

interface ProductNewImageUploaderProps {
  images: UploadedImage[]
  maxImages: number
  fieldError?: string
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: (imageId: string) => void
}

export function ProductNewImageUploader({
  images,
  maxImages,
  fieldError,
  onImageSelect,
  onRemoveImage,
}: ProductNewImageUploaderProps) {
  const uploadId = useId()
  const hintId = `${uploadId}-hint`
  const errorId = `${uploadId}-error`

  return (
    <fieldset>
      <legend className='mb-2 block text-sm font-medium text-text-primary'>
        {m.creator_product_new_images_label()}
      </legend>
      <p id={hintId} className='mb-3 text-xs text-text-muted'>
        {m.creator_product_new_images_hint()}
      </p>

      {images.length > 0 && (
        <div className='mb-3 grid grid-cols-2 gap-2'>
          {images.map((img) => (
            <div
              key={img.id}
              className='relative overflow-hidden rounded-lg border border-border-default'
            >
              {img.uploading ? (
                <div
                  className='flex aspect-square items-center justify-center bg-surface-inset'
                  role='status'
                  aria-live='polite'
                >
                  <div className='text-center'>
                    <svg
                      className='mx-auto size-6 animate-spin text-text-muted'
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                      aria-hidden='true'
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
                    <p className='mt-1 text-xs text-text-muted'>
                      {m.creator_product_new_images_reading()}
                    </p>
                  </div>
                </div>
              ) : img.error ? (
                <div
                  className='flex aspect-square items-center justify-center bg-error-subtle p-2 text-center'
                  role='alert'
                >
                  <p className='text-xs text-error'>{img.error}</p>
                </div>
              ) : (
                <img
                  src={img.previewUrl}
                  alt={img.altText || ''}
                  className='aspect-square w-full object-cover'
                />
              )}
              <button
                type='button'
                onClick={() => onRemoveImage(img.id)}
                className='absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-bg-overlay text-white backdrop-blur-sm transition hover:bg-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2'
                aria-label={m.creator_product_new_images_remove()}
              >
                <X size={16} aria-hidden='true' />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className='mb-3 flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border-default bg-surface-inset'>
          <div className='text-center'>
            <ImageIcon size={32} className='mx-auto mb-2 text-text-muted' aria-hidden='true' />
            <p className='text-sm text-text-muted'>{m.creator_product_new_images_no_images()}</p>
          </div>
        </div>
      )}

      <div>
        <input
          id={uploadId}
          type='file'
          accept='image/jpeg,image/png,image/webp'
          multiple
          onChange={onImageSelect}
          className='sr-only'
          aria-label={m.creator_product_new_images_label()}
          aria-describedby={`${hintId}${fieldError ? ` ${errorId}` : ''}`}
          aria-invalid={fieldError ? 'true' : undefined}
        />
        <Button
          type='button'
          variant='secondary'
          size='sm'
          onClick={() => document.getElementById(uploadId)?.click()}
          disabled={images.length >= maxImages}
          className='w-full'
        >
          <Upload size={16} aria-hidden='true' />
          {m.creator_product_new_images_add()}
        </Button>
        <p className='mt-1 text-xs text-text-muted text-center' role='status' aria-live='polite'>
          {images.filter((image) => !image.error && !image.uploading).length}/{maxImages}
        </p>
      </div>

      {fieldError && (
        <p id={errorId} className='mt-2 text-sm text-error' role='alert'>
          {fieldError}
        </p>
      )}
    </fieldset>
  )
}
