import { createFileRoute } from '@tanstack/react-router'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/terms')({
  head: () => {
    const { meta, links } = createPageMeta({
      title: m.terms_title(),
      description: m.terms_description(),
      canonicalPath: '/terms',
    })
    return { meta, links }
  },
  component: Terms,
})

function Terms() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <p className='island-kicker mb-2'>{m.terms_kicker()}</p>
        <h1 className='display-title mb-3 text-4xl font-bold text-text-primary sm:text-5xl'>
          {m.terms_title()}
        </h1>
        <p className='m-0 max-w-3xl text-base leading-8 text-text-secondary'>
          {m.terms_description()}
        </p>
      </section>
    </main>
  )
}
