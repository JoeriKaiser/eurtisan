import { m } from '#/paraglide/messages'
import { LegalRichText } from './LegalRichText'

export interface LegalSection {
  title: string
  text: string
}

interface LegalPageLayoutProps {
  kicker: string
  title: string
  lastUpdated: string
  sections: LegalSection[]
}

export default function LegalPageLayout({
  kicker,
  title,
  lastUpdated,
  sections,
}: LegalPageLayoutProps) {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='grid gap-8 lg:grid-cols-[240px_1fr]'>
        {/* Table of Contents — desktop only */}
        <aside className='hidden lg:block'>
          <nav aria-label={m.legal_toc_label()} className='sticky top-8'>
            <h2 className='mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted'>
              {m.legal_toc_title()}
            </h2>
            <ol className='space-y-2 border-l border-border-subtle'>
              {sections.map((section, i) => (
                <li key={section.title}>
                  <a
                    href={`#section-${i}`}
                    className='block border-l-2 border-transparent pl-4 text-sm text-text-secondary transition-colors hover:border-accent-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2'
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        {/* Document */}
        <article className='island-shell rounded-2xl p-6 sm:p-8 lg:p-10'>
          <header className='mb-10 border-b border-border-default pb-8'>
            <p className='island-kicker mb-3'>{kicker}</p>
            <h1 className='display-title mb-4 text-4xl font-semibold text-text-primary sm:text-5xl'>
              {title}
            </h1>
            <p className='text-sm font-medium text-text-muted'>{lastUpdated}</p>
          </header>

          <div className='max-w-none'>
            {sections.map((section, i) => (
              <section
                key={section.title}
                id={`section-${i}`}
                className='mb-10 scroll-mt-8 last:mb-0'
              >
                <h2 className='mb-4 text-2xl font-semibold text-text-primary'>{section.title}</h2>
                <LegalRichText text={section.text} />
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  )
}
