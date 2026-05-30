import { ArrowDown, ArrowUp, ImageIcon, Upload, X } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'

interface ExistingImageEntry {
  type: 'existing'
  id: string
  url: string
  altText: string
  sortOrder: number
}

interface NewImageEntry {
  type: 'new'
  id: string
  file: File
  dataUrl: string
  altText: string
  reading: boolean
  error: string | null
}

interface ProductEditImageUploaderProps {
  existingImages: ExistingImageEntry[]
  newImages: NewImageEntry[]
  maxImages: number
  fieldError?: string
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveExisting: (imageId: string) => void
  onRemoveNew: (imageId: string) => void
  onMoveUp: (imageId: string) => void
  onMoveDown: (imageId: string) => void
}

export function ProductEditImageUploader({
  existingImages,
  newImages,
  maxImages,
  fieldError,
  onImageSelect,
  onRemoveExisting,
  onRemoveNew,
  onMoveUp,
  onMoveDown,
}: ProductEditImageUploaderProps) {
  const totalImages = existingImages.length + newImages.length

  return (
    <div>
      <span className='mb-2 block text-sm font-medium text-text-primary'>
        {m.creator_product_new_images_label()}
      </span>
      <p className='mb-3 text-xs text-text-muted'>{m.creator_product_edit_images_hint()}</p>

      {totalImages > 0 && (
        <div className='mb-3 grid grid-cols-2 gap-2'>
          {existingImages.map((img, idx) => (
            <div
              key={img.id}
              className='group relative overflow-hidden rounded-lg border border-border-default'
            >
              <img
                src={img.url}
                alt={img.altText || ''}
                className='aspect-square w-full object-cover'
              />
              <div className='absolute inset-0 flex flex-col justify-between bg-black/0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100'>
                <div className='flex justify-end p-1'>
                  <button
                    type='button'
                    onClick={() => onRemoveExisting(img.id)}
                    className='flex size-6 items-center justify-center rounded-full bg-bg-overlay/80 text-white transition hover:bg-error'
                    aria-label={m.creator_product_edit_image_remove()}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className='flex justify-center gap-1 p-1'>
                  <button
                    type='button'
                    onClick={() => onMoveUp(img.id)}
                    disabled={idx === 0}
                    className='flex size-6 items-center justify-center rounded bg-bg-overlay/80 text-white transition hover:bg-surface-inset disabled:opacity-30'
                    aria-label={m.creator_product_edit_image_move_up()}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type='button'
                    onClick={() => onMoveDown(img.id)}
                    disabled={idx === existingImages.length - 1}
                    className='flex size-6 items-center justify-center rounded bg-bg-overlay/80 text-white transition hover:bg-surface-inset disabled:opacity-30'
                    aria-label={m.creator_product_edit_image_move_down()}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {newImages.map((img) => (
            <div
              key={img.id}
              className='relative overflow-hidden rounded-lg border border-border-default'
            >
              {img.reading ? (
                <div className='flex aspect-square items-center justify-center bg-surface-inset'>
                  <div className='text-center'>
                    <svg
                      className='mx-auto size-6 animate-spin text-text-muted'
                      xmlns='http://www.w3.org/2000/svg'
                      fill='none'
                      viewBox='0 0 24 24'
                      aria-label={m.creator_product_new_images_reading()}
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
                <div className='flex aspect-square items-center justify-center bg-error-subtle p-2 text-center'>
                  <p className='text-xs text-error'>{img.error}</p>
                </div>
              ) : (
                <img
                  src={img.dataUrl}
                  alt={img.altText || ''}
                  className='aspect-square w-full object-cover'
                />
              )}
              <button
                type='button'
                onClick={() => onRemoveNew(img.id)}
                className='absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-bg-overlay text-white backdrop-blur-sm transition hover:bg-error'
                aria-label={m.creator_product_new_images_remove()}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {totalImages === 0 && (
        <div className='mb-3 flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border-default bg-surface-inset'>
          <div className='text-center'>
            <ImageIcon size={32} className='mx-auto mb-2 text-text-muted' aria-hidden='true' />
            <p className='text-sm text-text-muted'>{m.creator_product_new_images_no_images()}</p>
          </div>
        </div>
      )}

      <div>
        <input
          id='product-image-upload'
          type='file'
          accept='image/jpeg,image/png,image/webp'
          multiple
          onChange={onImageSelect}
          className='hidden'
          aria-label={m.creator_product_new_images_label()}
        />
        <Button
          type='button'
          variant='secondary'
          size='sm'
          onClick={() => document.getElementById('product-image-upload')?.click()}
          disabled={totalImages >= maxImages}
          className='w-full'
        >
          <Upload size={16} aria-hidden='true' />
          {m.creator_product_new_images_add()}
        </Button>
        <p className='mt-1 text-xs text-text-muted text-center'>
          {totalImages}/{maxImages}
        </p>
      </div>

      {fieldError && <p className='mt-2 text-sm text-error'>{fieldError}</p>}
    </div>
  )
}
