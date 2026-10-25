import { Eye, MapPin, ShieldCheck, Store } from 'lucide-react'
import { m } from '#/paraglide/messages'

export function HomeValuePropositionStrip() {
  const pillars = [
    {
      Icon: MapPin,
      title: m.home_val_made_in_europe_title(),
      description: m.home_charter_item_2_desc(),
    },
    {
      Icon: Store,
      title: m.home_val_direct_title(),
      description: m.home_charter_item_1_desc(),
    },
    {
      Icon: ShieldCheck,
      title: m.home_val_secure_title(),
      description: m.home_charter_item_3_desc(),
    },
    {
      Icon: Eye,
      title: m.home_val_gdpr_title(),
      description: m.home_charter_item_4_desc(),
    },
  ]

  return (
    <section aria-label={m.home_charter_landmark()}>
      <div className='rounded-3xl border border-border-subtle bg-surface-default/60 p-8 sm:p-12'>
        <header>
          <h2 className='display-title text-2xl sm:text-3xl font-bold tracking-tight text-text-primary'>
            {m.home_charter_title()}
          </h2>
          <p className='text-sm text-text-secondary mt-2 max-w-2xl font-sans leading-relaxed'>
            {m.home_charter_desc()}
          </p>
        </header>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mt-8 pt-8 border-t border-border-subtle'>
          {pillars.map(({ Icon, title, description }) => (
            <div key={title} className='flex flex-col gap-3'>
              <div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary'>
                <Icon size={20} strokeWidth={1.5} aria-hidden='true' />
              </div>
              <div>
                <h3 className='text-sm font-semibold text-text-primary'>{title}</h3>
                <p className='mt-1 text-xs leading-relaxed text-text-secondary font-sans'>
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
