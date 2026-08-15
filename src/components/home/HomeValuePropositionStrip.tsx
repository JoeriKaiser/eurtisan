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
      className='border-y border-border-subtle bg-surface-default py-10 sm:py-12'
      aria-label='Value Proposition'
    >
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border-subtle'>
          {values.map(({ Icon, title, description }) => (
            <div key={title} className='flex items-start gap-4 lg:pl-6 lg:first:pl-0'>
              <div className='shrink-0 rounded-lg bg-accent-primary/10 p-2.5 text-accent-primary'>
                <Icon size={20} strokeWidth={1.5} aria-hidden='true' />
              </div>
              <div>
                <h3 className='text-sm font-bold text-text-primary'>{title}</h3>
                <p className='mt-1 text-xs leading-relaxed text-text-secondary'>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
