import { Link } from '@tanstack/react-router'
import { ArrowLeft, Search, Store, Tags } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export interface NotFoundPageProps {
  title?: string
  description?: string
  showBack?: boolean
  /**
   * Route-level props passed by TanStack Router when the component is used
   * as a `notFoundComponent`. They are accepted for type compatibility and
   * intentionally ignored by the presentational layer.
   */
  data?: unknown
  isNotFound?: boolean
  routeId?: string
}

const secondaryCtaClass =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border-default bg-surface-default px-4 text-sm font-semibold text-text-primary shadow-sm transition-all duration-fast ease-out hover:bg-bg-inset hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 active:scale-[0.98] active:duration-75 w-full sm:w-auto'

export function NotFoundPage({ title, description, showBack = true }: NotFoundPageProps) {
  const displayTitle = title ?? m.error_not_found()
  const displayDescription = description ?? m.error_not_found_description()

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
      return
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }

  return (
    <main className='page-wrap flex min-h-[60vh] items-center justify-center px-4 py-12'>
      <div className='mx-auto w-full max-w-xl text-center'>
        <p
          className='select-none text-9xl font-extrabold leading-none tracking-tight text-text-muted/20'
          aria-hidden='true'
        >
          404
        </p>

        <h1 className='mt-4 text-3xl font-semibold tracking-tight text-text-primary'>
          {displayTitle}
        </h1>

        <p className='mt-3 text-base leading-relaxed text-text-secondary'>{displayDescription}</p>

        <div className='mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap'>
          {showBack && (
            <Button variant='primary' size='md' onClick={handleBack} className='w-full sm:w-auto'>
              <ArrowLeft size={18} aria-hidden='true' />
              {m.not_found_back_cta()}
            </Button>
          )}

          <Link to='/search' className={secondaryCtaClass}>
            <Search size={18} aria-hidden='true' />
            {m.not_found_search_cta()}
          </Link>

          <Link to='/category/all' className={secondaryCtaClass}>
            <Tags size={18} aria-hidden='true' />
            {m.not_found_browse_categories_cta()}
          </Link>

          <Link to='/' className={secondaryCtaClass}>
            <Store size={18} aria-hidden='true' />
            {m.not_found_browse_shops_cta()}
          </Link>
        </div>
      </div>
    </main>
  )
}
