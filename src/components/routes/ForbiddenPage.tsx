import { Link } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { m } from '#/paraglide/messages'

export default function ForbiddenPage() {
  return (
    <main className='page-wrap flex flex-col items-center justify-center px-4 py-24'>
      <ShieldAlert size={64} aria-hidden='true' className='mb-6 text-error' />
      <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
        {m.forbidden_title()}
      </h1>
      <p className='mb-8 max-w-md text-center text-text-secondary'>{m.forbidden_description()}</p>
      <Link
        to='/'
        className='inline-flex h-11 items-center justify-center rounded-lg bg-accent-primary px-5 text-sm font-semibold text-text-on-primary shadow-sm transition-colors hover:bg-accent-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
      >
        {m.forbidden_go_home()}
      </Link>
    </main>
  )
}
