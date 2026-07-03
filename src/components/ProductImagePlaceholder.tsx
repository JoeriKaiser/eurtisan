import { ImageOff } from 'lucide-react'
import { m } from '#/paraglide/messages'

export interface ProductImagePlaceholderProps {
  className?: string
  iconSize?: number
}

export default function ProductImagePlaceholder({
  className,
  iconSize = 40,
}: ProductImagePlaceholderProps) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-accent-secondary-subtle to-surface-inset text-accent-secondary ${className ?? ''}`}
    >
      <ImageOff size={iconSize} strokeWidth={1.5} aria-hidden='true' />
      <span className='sr-only'>{m.product_no_image()}</span>
    </div>
  )
}
