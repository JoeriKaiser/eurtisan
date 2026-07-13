import { useId } from 'react'
import { ArrowDown, ArrowUp, ImageIcon, Upload, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export interface ImageEntry {
  id: string
  key: string
  previewUrl: string
  altText: string
  sortOrder: number
  isNew: boolean
  uploading?: boolean
  error?: string | null
}

interface ProductEditImageUploaderProps {
  images: ImageEntry[]
  maxImages: number
  fieldError?: string
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: (imageId: string) => void
  onMoveUp: (imageId: string) => void
  onMoveDown: (imageId: string) => void
}

export function ProductEditImageUploader({
  images,
  maxImages,
  fieldError,
  onImageSelect,
  onRemoveImage,
  onMoveUp,
  onMoveDown,
}: ProductEditImageUploaderProps) {
  const uploadId = useId()
  const hintId = `${uploadId}-hint`
  const errorId = `${uploadId}-error`

  return (
    <fieldset>
      <legend className='mb-2 block text-sm font-medium text-text-primary'>
        {m.creator_product_new_images_label()}
      </legend>
      <p id={hintId} className='mb-3 text-xs text-text-muted'>
        {m.creator_product_edit_images_hint()}
      </p>

      {images.length > 0 && (
        <div className='mb-3 grid grid-cols-2 gap-2'>
          {images.map((img, idx) => (
            <div
              key={img.id}
              className='group relative overflow-hidden rounded-lg border border-border-default'
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

              {!img.uploading && (
                <div className='absolute inset-0 flex flex-col justify-between bg-black/0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100'>
                  <div className='flex justify-end p-1'>
                    <button
                      type='button'
                      onClick={() => onRemoveImage(img.id)}
                      className='flex size-8 items-center justify-center rounded-full bg-bg-overlay/80 text-white transition hover:bg-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2'
                      aria-label={m.creator_product_edit_image_remove()}
                    >
                      <X size={16} aria-hidden='true' />
                    </button>
                  </div>
                  <div className='flex justify-center gap-1 p-1'>
                    <button
                      type='button'
                      onClick={() => onMoveUp(img.id)}
                      disabled={idx === 0}
                      className='flex size-8 items-center justify-center rounded bg-bg-overlay/80 text-white transition hover:bg-surface-inset disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2'
                      aria-label={m.creator_product_edit_image_move_up()}
                    >
                      <ArrowUp size={16} aria-hidden='true' />
                    </button>
                    <button
                      type='button'
                      onClick={() => onMoveDown(img.id)}
                      disabled={idx === images.length - 1}
                      className='flex size-8 items-center justify-center rounded bg-bg-overlay/80 text-white transition hover:bg-surface-inset disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2'
                      aria-label={m.creator_product_edit_image_move_down()}
                    >
                      <ArrowDown size={16} aria-hidden='true' />
                    </button>
                  </div>
                </div>
              )}
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
