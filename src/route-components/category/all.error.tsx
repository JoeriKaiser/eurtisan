import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'

export function CategoriesAllError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-semibold text-text-primary'>
        {m.error_unexpected()}
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
      <Link
        to='/'
        className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-medium text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover'
      >
        {m.forbidden_go_home()}
      </Link>
    </main>
  )
}
