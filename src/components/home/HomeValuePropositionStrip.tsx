import { Eye, MapPin, ShieldCheck, Store } from 'lucide-react'
import { m } from '#/paraglide/messages'

export function HomeValuePropositionStrip() {
  return (
    <section
      className='border-y border-border-subtle bg-bg-base/40 py-10'
      aria-label='Value Proposition'
    >
      <div className='max-w-7xl mx-auto px-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border-subtle/70'>
        <div className='flex items-start gap-4 transition-transform hover:translate-y-[-1px] duration-300'>
          <div className='p-2.5 rounded-2xl bg-accent-primary-subtle text-accent-primary shrink-0 border border-accent-primary/10 shadow-sm'>
            <MapPin size={20} strokeWidth={1.5} aria-hidden='true' />
          </div>
          <div>
            <h3 className='text-sm font-bold text-text-primary tracking-wide'>
              {m.home_val_made_in_europe_title()}
            </h3>
            <p className='text-xs text-text-secondary mt-1 leading-relaxed font-sans'>
              {m.home_val_made_in_europe_desc()}
            </p>
          </div>
        </div>

        <div className='flex items-start gap-4 lg:pl-6 transition-transform hover:translate-y-[-1px] duration-300'>
          <div className='p-2.5 rounded-2xl bg-accent-primary-subtle text-accent-primary shrink-0 border border-accent-primary/10 shadow-sm'>
            <Store size={20} strokeWidth={1.5} aria-hidden='true' />
          </div>
          <div>
            <h3 className='text-sm font-bold text-text-primary tracking-wide'>
              {m.home_val_direct_title()}
            </h3>
            <p className='text-xs text-text-secondary mt-1 leading-relaxed font-sans'>
              {m.home_val_direct_desc()}
            </p>
          </div>
        </div>

        <div className='flex items-start gap-4 lg:pl-6 transition-transform hover:translate-y-[-1px] duration-300'>
          <div className='p-2.5 rounded-2xl bg-accent-primary-subtle text-accent-primary shrink-0 border border-accent-primary/10 shadow-sm'>
            <ShieldCheck size={20} strokeWidth={1.5} aria-hidden='true' />
          </div>
          <div>
            <h3 className='text-sm font-bold text-text-primary tracking-wide'>
              {m.home_val_secure_title()}
            </h3>
            <p className='text-xs text-text-secondary mt-1 leading-relaxed font-sans'>
              {m.home_val_secure_desc()}
            </p>
          </div>
        </div>

        <div className='flex items-start gap-4 lg:pl-6 transition-transform hover:translate-y-[-1px] duration-300'>
          <div className='p-2.5 rounded-2xl bg-accent-primary-subtle text-accent-primary shrink-0 border border-accent-primary/10 shadow-sm'>
            <Eye size={20} strokeWidth={1.5} aria-hidden='true' />
          </div>
          <div>
            <h3 className='text-sm font-bold text-text-primary tracking-wide'>
              {m.home_val_gdpr_title()}
            </h3>
            <p className='text-xs text-text-secondary mt-1 leading-relaxed font-sans'>
              {m.home_val_gdpr_desc()}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
