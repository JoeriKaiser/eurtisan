import { createFileRoute } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import SearchSidebar from '../components/SearchSidebar'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const features = [
    { title: m.feature_tanstack_router_title(), desc: m.feature_tanstack_router_desc() },
    { title: m.feature_tanstack_query_title(), desc: m.feature_tanstack_query_desc() },
    { title: m.feature_better_auth_title(), desc: m.feature_better_auth_desc() },
    { title: m.feature_sentry_title(), desc: m.feature_sentry_desc() },
  ] as const

  return (
    <main className='page-wrap px-4 pb-8 pt-14'>
      <div className='grid gap-6 lg:grid-cols-[1fr_280px]'>
        <div>
          <section className='island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14'>
            <div className='pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]' />
            <div className='pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]' />
            <p className='island-kicker mb-3'>{m.home_kicker()}</p>
            <h1 className='display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl'>
              {m.home_title()}
            </h1>
            <p className='mb-8 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg'>
              {m.home_description()}
            </p>
          </section>

          <section className='mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {features.map(({ title, desc }, index) => (
              <article
                key={title}
                className='island-shell feature-card rise-in rounded-2xl p-5'
                style={{ animationDelay: `${index * 90 + 80}ms` }}
              >
                <h2 className='mb-2 text-base font-semibold text-[var(--sea-ink)]'>{title}</h2>
                <p className='m-0 text-sm text-[var(--sea-ink-soft)]'>{desc}</p>
              </article>
            ))}
          </section>
        </div>

        <div className='lg:pt-0'>
          <SearchSidebar />
        </div>
      </div>
    </main>
  )
}
