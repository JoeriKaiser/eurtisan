import { m } from '#/paraglide/messages'
import type { PublicOperatorProfile } from '#/lib/legal/operator'

export interface ImprintPageProps {
  operator?: PublicOperatorProfile
}

interface ImprintRow {
  label: string
  value: string
}

function optionalRow(label: string, value: string | undefined): ImprintRow | undefined {
  return value ? { label, value } : undefined
}

/**
 * French LCEN Article 6-III mentions légales. Renders every identifier the
 * operator profile provides and degrades gracefully when optional values are
 * unconfigured (development/staging) by omitting the affected rows.
 */
export default function ImprintPage({ operator }: ImprintPageProps = {}) {
  const operatorName = operator?.name || m.legal_operator_name()
  const contactEmail = operator?.email || m.legal_contact_email()

  const publisherRows = [
    optionalRow(m.imprint_field_legal_form(), operator?.legalForm),
    optionalRow(m.imprint_field_share_capital(), operator?.shareCapital),
    optionalRow(m.imprint_field_siren(), operator?.siren),
    optionalRow(m.imprint_field_siret(), operator?.siret),
    optionalRow(m.imprint_field_rcs_city(), operator?.rcsCity),
    optionalRow(m.imprint_field_vat_id(), operator?.vatId || m.legal_vat_number()),
    optionalRow(
      m.imprint_field_address(),
      operator?.formattedAddress || m.legal_operator_address(),
    ),
    optionalRow(m.imprint_field_email(), contactEmail),
  ].filter((row): row is ImprintRow => row !== undefined)

  const hosting = operator?.hosting

  const hasAllMandatoryIdentifiers =
    !!operator?.legalForm &&
    !!operator?.siren &&
    !!operator?.siret &&
    !!operator?.rcsCity &&
    !!operator?.publicationDirector &&
    !!hosting

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-4xl'>
        <article className='island-shell rounded-2xl p-6 sm:p-8 lg:p-10'>
          <header className='mb-10 border-b border-border-default pb-8'>
            <p className='island-kicker mb-3'>{m.imprint_kicker()}</p>
            <h1 className='display-title text-4xl font-semibold text-text-primary sm:text-5xl'>
              {m.imprint_title()}
            </h1>
          </header>

          <section className='mb-10'>
            <h2 className='mb-4 text-2xl font-semibold text-text-primary'>
              {m.imprint_publisher_title()}
            </h2>
            <p className='mb-4 leading-7 font-medium text-text-primary'>{operatorName}</p>
            <dl className='space-y-3'>
              {publisherRows.map((row) => (
                <div key={row.label} className='grid gap-1 sm:grid-cols-[220px_1fr] sm:gap-4'>
                  <dt className='text-sm font-medium text-text-muted'>{row.label}</dt>
                  <dd className='text-sm leading-6 text-text-secondary'>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {operator?.publicationDirector && (
            <section className='mb-10'>
              <h2 className='mb-4 text-2xl font-semibold text-text-primary'>
                {m.imprint_publishing_director_title()}
              </h2>
              <p className='leading-7 text-text-secondary'>{operator.publicationDirector}</p>
            </section>
          )}

          {hosting && (
            <section className='mb-10 last:mb-0'>
              <h2 className='mb-4 text-2xl font-semibold text-text-primary'>
                {m.imprint_hosting_title()}
              </h2>
              <p className='mb-4 leading-7 font-medium text-text-primary'>{hosting.name}</p>
              <dl className='space-y-3'>
                {hosting.address && (
                  <div className='grid gap-1 sm:grid-cols-[220px_1fr] sm:gap-4'>
                    <dt className='text-sm font-medium text-text-muted'>
                      {m.imprint_field_host_address()}
                    </dt>
                    <dd className='text-sm leading-6 text-text-secondary'>{hosting.address}</dd>
                  </div>
                )}
                {hosting.phone && (
                  <div className='grid gap-1 sm:grid-cols-[220px_1fr] sm:gap-4'>
                    <dt className='text-sm font-medium text-text-muted'>
                      {m.imprint_field_host_phone()}
                    </dt>
                    <dd className='text-sm leading-6 text-text-secondary'>{hosting.phone}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {!hasAllMandatoryIdentifiers && (
            <p role='note' className='text-sm text-text-muted'>
              {m.imprint_pending_configuration()}
            </p>
          )}
        </article>
      </div>
    </main>
  )
}
