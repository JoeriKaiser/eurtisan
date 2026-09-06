import { useCallback, useState } from 'react'
import { getImageUrl } from '../image-url'

/**
 * Responsive image component with:
 * - srcset + sizes for responsive delivery via imgproxy
 * - Lazy loading below the fold
 * - Blur-up placeholder while loading
 * - Accessible alt text fallback
 */

export interface ResponsiveImageProps {
  src: string
  alt: string
  /** Precomputed srcset string (bypasses buildSrcset). */
  srcset?: string
  /** Widths to include in srcset, in pixels. Default: [400, 800, 1200] */
  widths?: number[]
  /** Sizes attribute for the browser to pick the right source. Default assumes full-width card grid. */
  sizes?: string
  /** Whether the image is above the fold (eager) or below (lazy). Default: lazy */
  loading?: 'lazy' | 'eager'
  /** Browser resource prioritization hint. */
  fetchPriority?: 'high' | 'low' | 'auto'
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
  '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 25vw, 286px'
const DEFAULT_FORMAT = 'webp'

/**
 * Generates srcset string from an S3 object key and width list.
 * Uses imgproxy for on-the-fly resizing and WebP conversion.
 */
export function buildSrcset(key: string, widths: number[]): string {
  return widths
    .map((w) => {
      const url = getImageUrl(key, { width: w, format: DEFAULT_FORMAT })
      return `${url} ${w}w`
    })
    .join(', ')
}

export function ResponsiveImage({
  src,
  alt,
  srcset: srcsetProp,
  widths = DEFAULT_WIDTHS,
  sizes = DEFAULT_SIZES,
  loading = 'lazy',
  fetchPriority,
  className,
  imgClassName,
  placeholder = 'blur',
  fallback,
}: ResponsiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
  }, [])

  const handleError = useCallback(() => {
    setHasError(true)
    setIsLoaded(true)
  }, [])

  const imageRef = useCallback((node: HTMLImageElement | null) => {
    if (!node) return

    if (node.complete) {
      if (node.naturalWidth > 0) {
        setIsLoaded(true)
      } else {
        setHasError(true)
        setIsLoaded(true)
      }
      return
    }

    const onLoad = () => {
      setIsLoaded(true)
    }

    const onError = () => {
      setHasError(true)
      setIsLoaded(true)
    }

    node.addEventListener('load', onLoad, { once: true })
    node.addEventListener('error', onError, { once: true })

    return () => {
      node.removeEventListener('load', onLoad)
      node.removeEventListener('error', onError)
    }
  }, [])

  if (!src) {
    return <>{fallback}</>
  }

  const defaultUrl = getImageUrl(src, { format: DEFAULT_FORMAT })
  const srcset = srcsetProp ?? buildSrcset(src, widths)

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Zero-HTTP-request CSS shimmer skeleton */}
      {placeholder === 'blur' && !isLoaded && !hasError && (
        <div
          className='absolute inset-0 h-full w-full bg-surface-inset animate-pulse pointer-events-none'
          aria-hidden='true'
        />
      )}

      {hasError && (
        <div className='absolute inset-0 flex h-full w-full items-center justify-center bg-surface-inset'>
          {fallback ?? <span className='sr-only'>{alt}</span>}
        </div>
      )}

      <img
        ref={imageRef}
        src={defaultUrl}
        srcSet={srcset}
        sizes={sizes}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${
          isLoaded && !hasError ? 'opacity-100' : 'opacity-0'
        } ${imgClassName ?? 'h-full w-full object-cover'}`}
      />
    </div>
  )
}
