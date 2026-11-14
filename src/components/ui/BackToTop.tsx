import { ArrowUp } from 'lucide-react'
import { useCallback, useSyncExternalStore } from 'react'
import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'

export interface BackToTopProps {
  threshold?: number
  className?: string
}

export function BackToTop({ threshold = 400, className }: BackToTopProps) {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('scroll', callback, { passive: true })
    return () => window.removeEventListener('scroll', callback)
  }, [])

  const isVisible = useSyncExternalStore(
    subscribe,
    () => typeof window !== 'undefined' && window.scrollY > threshold,
    () => false,
  )

  const handleScrollToTop = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'instant' : 'smooth',
    })
  }

  if (!isVisible) return null

  return (
    <button
      type='button'
      onClick={handleScrollToTop}
      aria-label={m.nav_back_to_top()}
      title={m.nav_back_to_top()}
      className={cn(
        'fixed bottom-6 right-6 z-sticky flex size-11 items-center justify-center rounded-full',
        'border border-border-default bg-surface-default/95 text-text-primary shadow-lg backdrop-blur-md',
        'transition-all duration-fast hover:border-border-strong hover:bg-surface-inset hover:text-accent-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2',
        'active:scale-95',
        className,
      )}
    >
      <ArrowUp size={18} aria-hidden='true' />
      <span className='sr-only'>{m.nav_back_to_top()}</span>
    </button>
  )
}
