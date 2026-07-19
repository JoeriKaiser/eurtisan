import { Eye, MapPin, ShieldCheck, Store } from 'lucide-react'
import { m } from '#/paraglide/messages'

export function HomeValuePropositionStrip() {
  const values = [
    {
      Icon: MapPin,
      title: m.home_val_made_in_europe_title(),
      description: m.home_val_made_in_europe_desc(),
    },
    {
      Icon: Store,
      title: m.home_val_direct_title(),
      description: m.home_val_direct_desc(),
    },
    {
      Icon: ShieldCheck,
      title: m.home_val_secure_title(),
      description: m.home_val_secure_desc(),
    },
    {
      Icon: Eye,
      title: m.home_val_gdpr_title(),
      description: m.home_val_gdpr_desc(),
    },
  ]

  return (
    <section
      className='border-y border-border-subtle bg-bg-base/40 py-7 lg:py-10'
      aria-label='Value Proposition'
    >
      <div className='mx-auto max-w-7xl px-6'>
        <div className='flex gap-6 overflow-x-auto md:grid md:grid-cols-2 md:gap-8 lg:grid-cols-4 lg:divide-x lg:divide-border-subtle/70'>
          {values.map(({ Icon, title, description }) => (
            <div
              key={title}
              className='flex min-w-[78vw] items-start gap-4 md:min-w-0 lg:pl-6 lg:first:pl-0'
            >
              <div className='shrink-0 rounded-2xl border border-accent-primary/10 bg-accent-primary-subtle p-2.5 text-accent-primary shadow-sm'>
                <Icon size={20} strokeWidth={1.5} aria-hidden='true' />
              </div>
              <div>
                <h3 className='text-sm font-bold tracking-wide text-text-primary'>{title}</h3>
                <p className='mt-1 text-xs leading-relaxed text-text-secondary'>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
