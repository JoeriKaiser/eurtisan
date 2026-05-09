import { createFileRoute } from '@tanstack/react-router'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/account/settings')({
  beforeLoad: async () => guardAuth(),
  component: AccountSettings,
})

function AccountSettings() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-4 text-3xl font-bold text-text-primary'>
          {m.account_settings()}
        </h1>
        <p className='text-text-secondary'>
          Settings page placeholder. Profile and preferences will be managed here.
        </p>
      </section>
    </main>
  )
}
