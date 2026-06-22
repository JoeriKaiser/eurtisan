import { createFileRoute, Link, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import z from 'zod'

import { unsubscribeByToken } from '#/lib/unsubscribe'
import { m } from '#/paraglide/messages'

const unsubscribeSearchSchema = z.object({
  token: z.string().optional().catch(''),
  category: z.string().optional().catch(''),
})

export const Route = createFileRoute('/unsubscribe')({
  validateSearch: unsubscribeSearchSchema,
  component: UnsubscribePage,
})

function UnsubscribePage() {
  const { token, category } = useSearch({ from: '/unsubscribe' })
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [disabledCategory, setDisabledCategory] = useState<string | undefined>()

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }

    const normalizedCategory =
      category === 'seller_updates' ||
      category === 'marketing' ||
      category === 'platform_announcements'
        ? category
        : undefined

    unsubscribeByToken({ data: { token, category: normalizedCategory } })
      .then((result) => {
        if (result.success) {
          setStatus('success')
          setDisabledCategory(result.category)
        } else {
          setStatus('error')
        }
      })
      .catch(() => {
        setStatus('error')
      })
  }, [token, category])

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-xl space-y-6 text-center'>
        {status === 'loading' && (
          <>
            <h1 className='display-title text-2xl font-semibold text-text-primary'>
              {m.unsubscribe_loading_title()}
            </h1>
            <p className='text-text-secondary'>{m.unsubscribe_loading_description()}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className='display-title text-2xl font-semibold text-text-primary'>
              {m.unsubscribe_success_title()}
            </h1>
            <p className='text-text-secondary'>
              {disabledCategory
                ? m.unsubscribe_success_category({ category: disabledCategory })
                : m.unsubscribe_success_global()}
            </p>
            <p className='text-sm text-text-secondary'>{m.unsubscribe_transactional_note()}</p>
            <div className='pt-4'>
              <Link
                to='/account/settings'
                className='inline-flex items-center justify-center rounded-lg border border-border-default bg-surface-default px-4 py-2 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:bg-bg-inset hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
              >
                {m.unsubscribe_manage_preferences()}
              </Link>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className='display-title text-2xl font-semibold text-text-primary'>
              {m.unsubscribe_error_title()}
            </h1>
            <p className='text-text-secondary'>{m.unsubscribe_error_description()}</p>
            <div className='pt-4'>
              <Link
                to='/account/settings'
                className='inline-flex items-center justify-center rounded-lg border border-border-default bg-surface-default px-4 py-2 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:bg-bg-inset hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
              >
                {m.unsubscribe_manage_preferences()}
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
