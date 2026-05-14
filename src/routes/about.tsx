import { createFileRoute } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import { createPageMeta } from '#/lib/seo'

export const Route = createFileRoute('/about')({
  head: () => {
    const { meta, links } = createPageMeta({
      title: m.about_title(),
      description: m.about_description(),
      canonicalPath: '/about',
    })
    return { meta, links }
  },
  component: About,
})

function About() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <p className='island-kicker mb-2'>{m.about_kicker()}</p>
        <h1 className='display-title mb-3 text-4xl font-bold text-text-primary sm:text-5xl'>
          {m.about_title()}
        </h1>
        <p className='m-0 max-w-3xl text-base leading-8 text-text-secondary'>
          {m.about_description()}
        </p>
      </section>
    </main>
  )
}
