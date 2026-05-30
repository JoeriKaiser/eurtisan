import { useCallback, useState } from 'react'
import { getImageUrl } from './image-url'

/**
 * Responsive image component with:
 * - srcset + sizes for responsive delivery via imgproxy
 * - Lazy loading below the fold
 * - Blur-up placeholder while loading
 * - Accessible alt text fallback
 */

interface ResponsiveImageProps {
  src: string
  alt: string
  /** Widths to include in srcset, in pixels. Default: [400, 800, 1200] */
  widths?: number[]
  /** Sizes attribute for the browser to pick the right source. Default assumes full-width card grid. */
  sizes?: string
  /** Whether the image is above the fold (eager) or below (lazy). Default: lazy */
  loading?: 'lazy' | 'eager'
  /** CSS class for the wrapper */
  className?: string
  /** CSS class for the image element */
  imgClassName?: string
  /** Whether to show a blur placeholder while loading */
  placeholder?: 'blur' | 'none'
  /** Fallback element when no src is provided */
  fallback?: React.ReactNode
}

const DEFAULT_WIDTHS = [400, 800, 1200]
const DEFAULT_SIZES =
  '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw'

/**
 * Generates srcset string from an S3 object key and width list.
 * Uses imgproxy for on-the-fly resizing and WebP conversion.
 */
function buildSrcset(key: string, widths: number[]): string {
  return widths
    .map((w) => {
      const url = getImageUrl(key, { width: w })
      return `${url} ${w}w`
    })
    .join(', ')
}

export function ResponsiveImage({
  src,
  alt,
  widths = DEFAULT_WIDTHS,
  sizes = DEFAULT_SIZES,
  loading = 'lazy',
  className,
  imgClassName,
  placeholder = 'blur',
  fallback,
}: ResponsiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
  }, [])

  if (!src) {
    return <>{fallback}</>
  }

  const defaultUrl = getImageUrl(src)
  const srcset = buildSrcset(src, widths)
  const blurUrl = getImageUrl(src, { width: 40 })

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Blur placeholder */}
      {placeholder === 'blur' && !isLoaded && (
        <img
          src={blurUrl}
          alt=''
          className='absolute inset-0 h-full w-full scale-110 object-cover blur-[20px]'
          aria-hidden='true'
        />
      )}

      <img
        src={defaultUrl}
        srcSet={srcset}
        sizes={sizes}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        className={`transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName ?? 'h-full w-full object-cover'}`}
      />
    </div>
  )
}
