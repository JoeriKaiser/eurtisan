import { createFileRoute } from '@tanstack/react-router'
import { guardRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async () => guardRole('admin'),
  component: Admin,
})

function Admin() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-4 text-3xl font-bold text-[var(--sea-ink)]'>
          {m.admin_title()}
        </h1>
        <p className='text-[var(--sea-ink-soft)]'>{m.admin_description()}</p>
      </section>
    </main>
  )
}
