import { ImageIcon, Upload, X } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'

interface ShopSettingsImageUploaderProps {
  id?: string
  imagePreview: string | null
  imageError: string | null
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: () => void
  label?: string
  hint?: string
  emptyText?: string
  changeText?: string
  uploadText?: string
  removeLabel?: string
  previewAlt?: string
  aspectClass?: string
}

export function ShopSettingsImageUploader({
  id = 'shop-image-upload',
  imagePreview,
  imageError,
  onImageSelect,
  onRemoveImage,
  label,
  hint,
  emptyText,
  changeText,
  uploadText,
  removeLabel,
  previewAlt,
  aspectClass = 'aspect-video',
}: ShopSettingsImageUploaderProps) {
  return (
    <div>
      <label htmlFor={id} className='mb-2 block text-sm font-medium text-text-primary'>
        {label ?? m.creator_shop_image_label()}
      </label>
      <p className='mb-3 text-xs text-text-muted'>{hint ?? m.creator_shop_image_hint()}</p>

      {imagePreview ? (
        <div className='relative mb-3 overflow-hidden rounded-lg border border-border-default'>
          <img
            src={imagePreview}
            alt={previewAlt ?? m.creator_shop_image_preview_alt()}
            className={`${aspectClass} w-full object-cover`}
          />
          <button
            type='button'
            onClick={onRemoveImage}
            className='absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-bg-overlay text-white backdrop-blur-sm transition hover:bg-error'
            aria-label={removeLabel ?? m.creator_shop_image_remove()}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          className={`mb-3 flex ${aspectClass} items-center justify-center rounded-lg border-2 border-dashed border-border-default bg-surface-inset`}
        >
          <div className='text-center'>
            <ImageIcon size={32} className='mx-auto mb-2 text-text-muted' aria-hidden='true' />
            <p className='text-sm text-text-muted'>{emptyText ?? m.creator_shop_image_empty()}</p>
          </div>
        </div>
      )}

      <div>
        <input
          id={id}
          type='file'
          accept='image/jpeg,image/png,image/webp'
          onChange={onImageSelect}
          className='hidden'
          aria-label={label ?? m.creator_shop_image_label()}
        />
        <Button
          type='button'
          variant='secondary'
          size='sm'
          onClick={() => document.getElementById(id)?.click()}
          className='w-full'
        >
          <Upload size={16} aria-hidden='true' />
          {imagePreview
            ? (changeText ?? m.creator_shop_image_change())
            : (uploadText ?? m.creator_shop_image_upload())}
        </Button>
      </div>

      {imageError && <p className='mt-2 text-sm text-error'>{imageError}</p>}
    </div>
  )
}
