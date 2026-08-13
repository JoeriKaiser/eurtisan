import { m } from '#/paraglide/messages'

export function StatusPending() {
  return (
    <main
      className='page-wrap px-4 py-12'
      aria-busy='true'
      aria-label={m.onboarding_status_loading()}
    >
      <div className='mx-auto max-w-2xl animate-pulse rounded-2xl bg-surface-inset p-8'>
        <div className='mx-auto size-20 rounded-2xl bg-surface-elevated' />
        <div className='mx-auto mt-5 h-7 w-64 rounded bg-surface-elevated' />
        <div className='mx-auto mt-3 h-16 max-w-lg rounded bg-surface-elevated' />
      </div>
    </main>
  )
}
