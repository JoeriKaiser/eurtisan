import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { m } from '#/paraglide/messages'

export function SearchError() {
  return (
    <main className='mx-auto w-full max-w-[1240px] px-4 py-20 text-center'>
      <div className='mx-auto max-w-lg rounded-2xl border border-border-default bg-surface-inset p-8 sm:p-12'>
        <Search size={36} className='mx-auto mb-4 text-accent-primary' aria-hidden='true' />
        <h1 className='display-title mb-3 text-3xl font-semibold text-text-primary'>
          {m.error_unexpected()}
        </h1>
        <p className='mb-6 leading-7 text-text-secondary'>{m.search_error_description()}</p>
        <Link
          to='/search'
          search={{}}
          className='inline-flex min-h-11 items-center rounded-xl bg-accent-primary px-6 py-3 text-sm font-semibold text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover active:bg-accent-primary-active'
        >
          {m.search_error_action()}
        </Link>
      </div>
    </main>
  )
}
