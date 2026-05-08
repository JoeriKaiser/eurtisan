import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className='page-wrap px-4 pb-8 pt-14'>
      <section className='island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14'>
        <div className='pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]' />
        <div className='pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]' />
        <p className='island-kicker mb-3'>TanStack Start</p>
        <h1 className='display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl'>
          Full-stack React, type-safe from the start.
        </h1>
        <p className='mb-8 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg'>
          A production-ready starter with routing, auth, database access, forms, and monitoring
          wired in.
        </p>
      </section>

      <section className='mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {[
          ['TanStack Router', 'File-based, type-safe routing with automatic code generation.'],
          ['TanStack Query', 'Powerful async state management with server-side caching.'],
          ['Better Auth', 'Email and password authentication with session management.'],
          ['Sentry', 'Full-stack error tracking and performance monitoring.'],
        ].map(([title, desc], index) => (
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
    </main>
  )
}
