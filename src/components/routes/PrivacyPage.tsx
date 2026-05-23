import { m } from '#/paraglide/messages'

export default function PrivacyPage() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <p className='island-kicker mb-2'>{m.privacy_kicker()}</p>
        <h1 className='display-title mb-3 text-4xl font-semibold text-text-primary sm:text-5xl'>
          {m.privacy_title()}
        </h1>
        <p className='m-0 max-w-3xl text-base leading-8 text-text-secondary'>
          {m.privacy_description()}
        </p>
      </section>
    </main>
  )
}
