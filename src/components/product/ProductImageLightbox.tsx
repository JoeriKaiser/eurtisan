import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type * as React from 'react'
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import type { ProductDetail as ProductDetailType } from '#/lib/products.server'
import { ResponsiveImage } from '#/lib/responsive-image'
import { m } from '#/paraglide/messages'

export interface ProductImageLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: NonNullable<ProductDetailType['images']>
  selectedIndex: number
  onSelectIndex: (index: number) => void
  productName: string
}

/**
 * Accessible zoom lightbox for product craft photos with arrow-key navigation
 * and synchronized thumbnail index selection.
 */
export function ProductImageLightbox({
  open,
  onOpenChange,
  images,
  selectedIndex,
  onSelectIndex,
  productName,
}: ProductImageLightboxProps) {
  if (images.length === 0) return null

  const safeIndex = Math.max(0, Math.min(images.length - 1, selectedIndex))
  const currentImage = images[safeIndex]
  const hasMultiple = images.length > 1

  const goPrev = () => {
    if (!hasMultiple) return
    onSelectIndex((safeIndex - 1 + images.length) % images.length)
  }

  const goNext = () => {
    if (!hasMultiple) return
    onSelectIndex((safeIndex + 1) % images.length)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!hasMultiple) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goPrev()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goNext()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup
          onKeyDown={handleKeyDown}
          className='flex max-h-[92dvh] w-[min(95vw,64rem)] max-w-none flex-col overflow-hidden bg-surface-elevated p-3 sm:p-5'
        >
          <div className='flex items-center justify-between gap-4 pb-3'>
            <div className='min-w-0'>
              <DialogTitle className='truncate text-sm font-semibold text-text-primary sm:text-base'>
                {productName}
              </DialogTitle>
              <p className='text-xs text-text-secondary tabular-nums' aria-live='polite'>
                {m.product_gallery_image({
                  index: String(safeIndex + 1),
                  total: String(images.length),
                })}
              </p>
            </div>

            <DialogClose
              aria-label={m.product_lightbox_close()}
              className='inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-default bg-surface-default text-text-primary transition-colors hover:bg-surface-inset focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
            >
              <X size={20} aria-hidden='true' />
            </DialogClose>
          </div>

          <div className='relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-surface-inset'>
            <ResponsiveImage
              key={currentImage.id}
              src={currentImage.url}
              alt={currentImage.altText ?? productName}
              loading='eager'
              srcset={currentImage.srcset}
              fetchPriority='high'
              sizes='92vw'
              className='w-full'
              imgClassName='max-h-[72dvh] w-full object-contain'
            />

            {hasMultiple && (
              <>
                <button
                  type='button'
                  onClick={goPrev}
                  aria-label={m.product_lightbox_previous()}
                  className='absolute left-2 top-1/2 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-default bg-surface-default/90 text-text-primary shadow-md backdrop-blur-xs transition-colors hover:bg-surface-default focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-secondary sm:left-3'
                >
                  <ChevronLeft size={20} aria-hidden='true' />
                </button>
                <button
                  type='button'
                  onClick={goNext}
                  aria-label={m.product_lightbox_next()}
                  className='absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-default bg-surface-default/90 text-text-primary shadow-md backdrop-blur-xs transition-colors hover:bg-surface-default focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-secondary sm:right-3'
                >
                  <ChevronRight size={20} aria-hidden='true' />
                </button>
              </>
            )}
          </div>

          {hasMultiple && (
            <div
              className='mt-3 flex justify-center gap-2 overflow-x-auto pb-1'
              role='tablist'
              aria-label={m.product_gallery_label()}
            >
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type='button'
                  role='tab'
                  aria-selected={index === safeIndex}
                  aria-label={m.product_gallery_image({
                    index: String(index + 1),
                    total: String(images.length),
                  })}
                  onClick={() => onSelectIndex(index)}
                  className={`relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-secondary ${
                    index === safeIndex
                      ? 'border-accent-secondary'
                      : 'border-transparent hover:border-border-strong'
                  }`}
                >
                  <ResponsiveImage
                    src={image.url}
                    alt={image.altText ?? ''}
                    loading='lazy'
                    srcset={image.thumbnailSrcset ?? image.srcset}
                    widths={[80, 160]}
                    sizes='56px'
                    placeholder='none'
                    className='h-full w-full'
                    imgClassName='h-full w-full object-cover'
                  />
                </button>
              ))}
            </div>
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
