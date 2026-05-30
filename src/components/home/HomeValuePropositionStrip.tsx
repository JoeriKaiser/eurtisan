import { Eye, MapPin, ShieldCheck, Store } from 'lucide-react'
import { m } from '#/paraglide/messages'

export function HomeValuePropositionStrip() {
  return (
    <section className='border-y border-border-subtle py-8' aria-label='Value Proposition'>
      <div className='max-w-7xl mx-auto px-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'>
        <div className='flex items-start gap-3'>
          <div className='p-2 rounded-xl bg-accent-primary-subtle text-accent-primary shrink-0'>
            <MapPin size={20} aria-hidden='true' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-text-primary'>
              {m.home_val_made_in_europe_title()}
            </h3>
            <p className='text-xs text-text-secondary mt-0.5 leading-relaxed'>
              {m.home_val_made_in_europe_desc()}
            </p>
          </div>
        </div>
        <div className='flex items-start gap-3'>
          <div className='p-2 rounded-xl bg-accent-primary-subtle text-accent-primary shrink-0'>
            <Store size={20} aria-hidden='true' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-text-primary'>{m.home_val_direct_title()}</h3>
            <p className='text-xs text-text-secondary mt-0.5 leading-relaxed'>
              {m.home_val_direct_desc()}
            </p>
          </div>
        </div>
        <div className='flex items-start gap-3'>
          <div className='p-2 rounded-xl bg-accent-primary-subtle text-accent-primary shrink-0'>
            <ShieldCheck size={20} aria-hidden='true' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-text-primary'>{m.home_val_secure_title()}</h3>
            <p className='text-xs text-text-secondary mt-0.5 leading-relaxed'>
              {m.home_val_secure_desc()}
            </p>
          </div>
        </div>
        <div className='flex items-start gap-3'>
          <div className='p-2 rounded-xl bg-accent-primary-subtle text-accent-primary shrink-0'>
            <Eye size={20} aria-hidden='true' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-text-primary'>{m.home_val_gdpr_title()}</h3>
            <p className='text-xs text-text-secondary mt-0.5 leading-relaxed'>
              {m.home_val_gdpr_desc()}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
