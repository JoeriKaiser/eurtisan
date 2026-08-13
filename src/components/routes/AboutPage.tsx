import { m } from '#/paraglide/messages'

export default function AboutPage() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <p className='island-kicker mb-2'>{m.about_kicker()}</p>
        <h1 className='display-title mb-3 text-4xl font-semibold text-text-primary sm:text-5xl'>
          {m.about_title()}
        </h1>
        <p className='m-0 max-w-3xl text-base leading-8 text-text-secondary'>
          {m.about_description()}
        </p>
      </section>

      <section className='mt-8 grid gap-6 lg:grid-cols-2'>
        <div className='island-shell rounded-2xl p-6 sm:p-8'>
          <h2 className='mb-3 text-2xl font-semibold text-text-primary'>
            {m.about_mission_title()}
          </h2>
          <p className='leading-relaxed text-text-secondary'>{m.about_mission_text()}</p>
        </div>

        <div className='island-shell rounded-2xl p-6 sm:p-8'>
          <h2 className='mb-4 text-2xl font-semibold text-text-primary'>
            {m.about_values_title()}
          </h2>
          <ul className='space-y-4'>
            <li>
              <h3 className='font-semibold text-text-primary'>{m.about_values_makers_title()}</h3>
              <p className='text-sm leading-relaxed text-text-secondary'>
                {m.about_values_makers_text()}
              </p>
            </li>
            <li>
              <h3 className='font-semibold text-text-primary'>{m.about_values_quality_title()}</h3>
              <p className='text-sm leading-relaxed text-text-secondary'>
                {m.about_values_quality_text()}
              </p>
            </li>
            <li>
              <h3 className='font-semibold text-text-primary'>{m.about_values_europe_title()}</h3>
              <p className='text-sm leading-relaxed text-text-secondary'>
                {m.about_values_europe_text()}
              </p>
            </li>
            <li>
              <h3 className='font-semibold text-text-primary'>
                {m.about_values_sustainability_title()}
              </h3>
              <p className='text-sm leading-relaxed text-text-secondary'>
                {m.about_values_sustainability_text()}
              </p>
            </li>
          </ul>
        </div>
      </section>

      <section className='mt-8 island-shell rounded-2xl p-6 sm:p-8'>
        <h2 className='mb-3 text-2xl font-semibold text-text-primary'>{m.about_trust_title()}</h2>
        <p className='max-w-3xl leading-relaxed text-text-secondary'>{m.about_trust_text()}</p>
      </section>
    </main>
  )
}
