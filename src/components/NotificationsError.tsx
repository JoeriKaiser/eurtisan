import { m } from '#/paraglide/messages'

export function NotificationsError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-semibold text-text-primary'>
          {m.notifications_title()}
        </h1>
        <div className='py-12 text-center'>
          <p className='text-text-secondary'>{m.notifications_error()}</p>
          <p className='mt-2 text-sm text-text-muted'>{error.message}</p>
        </div>
      </section>
    </main>
  )
}
