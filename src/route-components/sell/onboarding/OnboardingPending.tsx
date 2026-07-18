import { m } from '#/paraglide/messages'

export function OnboardingPending() {
  return (
    <main
      className='min-h-[100dvh] bg-bg-base p-4 md:p-8'
      aria-busy='true'
      aria-label={m.onboarding_loading()}
    >
      <div className='mx-auto grid max-w-5xl animate-pulse gap-6 md:grid-cols-[14rem_1fr]'>
        <div className='h-72 rounded-2xl bg-surface-inset' />
        <div className='space-y-5'>
          <div className='h-8 w-64 rounded bg-surface-inset' />
          <div className='h-20 rounded-xl bg-surface-inset' />
          <div className='h-40 rounded-xl bg-surface-inset' />
        </div>
      </div>
    </main>
  )
}
