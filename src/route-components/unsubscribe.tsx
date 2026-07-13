import { Link, useLoaderData } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'

function PreferencesLink() {
  return (
    <div className='pt-4'>
      <Link
        to='/account/settings'
        className='inline-flex items-center justify-center rounded-lg border border-border-default bg-surface-default px-4 py-2 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:bg-bg-inset hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
      >
        {m.unsubscribe_manage_preferences()}
      </Link>
    </div>
  )
}

export function UnsubscribePending() {
  return (
    <main className='page-wrap px-4 py-12' aria-live='polite'>
      <div className='mx-auto max-w-xl space-y-6 text-center'>
        <h1 className='display-title text-2xl font-semibold text-text-primary'>
          {m.unsubscribe_loading_title()}
        </h1>
        <p className='text-text-secondary'>{m.unsubscribe_loading_description()}</p>
      </div>
    </main>
  )
}

export function UnsubscribePage() {
  const result = useLoaderData({ from: '/unsubscribe' })

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-xl space-y-6 text-center'>
        {result.success ? (
          <>
            <h1 className='display-title text-2xl font-semibold text-text-primary'>
              {m.unsubscribe_success_title()}
            </h1>
            <p className='text-text-secondary'>
              {result.category
                ? m.unsubscribe_success_category({ category: result.category })
                : m.unsubscribe_success_global()}
            </p>
            <p className='text-sm text-text-secondary'>{m.unsubscribe_transactional_note()}</p>
            <PreferencesLink />
          </>
        ) : (
          <>
            <h1 className='display-title text-2xl font-semibold text-text-primary'>
              {m.unsubscribe_error_title()}
            </h1>
            <p className='text-text-secondary'>{m.unsubscribe_error_description()}</p>
            <PreferencesLink />
          </>
        )}
      </div>
    </main>
  )
}
