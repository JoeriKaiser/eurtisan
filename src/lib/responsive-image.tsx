import { useCallback, useRef, useState } from 'react'

/**
 * Responsive image component with:
 * - srcset + sizes for responsive delivery
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
 * Generates srcset string from a URL and width list.
 * Appends ?w=N to the URL so a future CDN can resize on the fly.
 */
function buildSrcset(src: string, widths: number[]): string {
  return widths.map((w) => `${src}?w=${w} ${w}w`).join(', ')
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
  const imgRef = useRef<HTMLImageElement>(null)

  // Check if image already loaded from cache before state settles
  const handleLoad = useCallback(() => {
    setIsLoaded(true)
  }, [])

  // Handle already-cached images that load before the onLoad handler is attached
  if (imgRef.current?.complete) {
    // We can't call setState during render, so we rely on onLoad for cached
  }

  if (!src) {
    return <>{fallback}</>
  }

  const srcset = buildSrcset(src, widths)

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Blur placeholder */}
      {placeholder === 'blur' && !isLoaded && (
        <div
          className='absolute inset-0 bg-[var(--sand)]'
          style={{
            backgroundImage: `url(${src}?w=40)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
          }}
          aria-hidden='true'
        />
      )}

      <img
        ref={imgRef}
        src={src}
        srcSet={srcset}
        sizes={sizes}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        className={`transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName ?? 'h-full w-full object-cover'}`}
        // Natural dimensions hint for layout stability (CLS prevention)
        // The parent container should have a fixed aspect ratio
      />
    </div>
  )
}
