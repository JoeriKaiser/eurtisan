import { createFileRoute, Link } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/forbidden')({
  component: Forbidden,
})

function Forbidden() {
  return (
    <main className='page-wrap flex flex-col items-center justify-center px-4 py-24'>
      <ShieldAlert size={64} className='mb-6 text-red-500 dark:text-red-400' />
      <h1 className='display-title mb-2 text-3xl font-bold text-text-primary'>
        {m.forbidden_title()}
      </h1>
      <p className='mb-8 max-w-md text-center text-text-secondary'>{m.forbidden_description()}</p>
      <Link
        to='/'
        className='h-9 px-4 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors inline-flex items-center'
      >
        {m.forbidden_go_home()}
      </Link>
    </main>
  )
}
