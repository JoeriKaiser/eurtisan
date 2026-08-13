import { ExternalLink, Globe } from 'lucide-react'
import type { ShopDraft } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'

interface ShopStorySectionProps {
  details: ShopDraft
}

export function ShopStorySection({ details }: ShopStorySectionProps) {
  return (
    <div className='space-y-2'>
      <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
        {m.admin_shops_application_section_story()}
      </h3>
      <div className='bg-surface-inset rounded-xl p-4 space-y-3 border border-border-subtle'>
        <div>
          <p className='text-xs text-text-muted'>{m.admin_shops_application_field_desc()}</p>
          <p className='text-sm text-text-primary whitespace-pre-wrap leading-relaxed max-w-[65ch] mt-0.5'>
            {details.description || '—'}
          </p>
        </div>
        {details.languages.length > 0 && (
          <div>
            <p className='text-xs text-text-muted'>Languages</p>
            <p className='text-sm text-text-primary mt-0.5'>{details.languages.join(', ')}</p>
          </div>
        )}
        {details.socials && details.socials.length > 0 && (
          <div>
            <p className='text-xs text-text-muted'>{m.admin_shops_application_field_socials()}</p>
            <div className='flex flex-col gap-1.5 mt-1'>
              {details.socials.map((s: { id: string; platform: string; url: string }) => (
                <a
                  key={s.id}
                  href={s.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-xs text-accent-primary hover:underline flex items-center gap-1 w-fit'
                >
                  <Globe size={12} className='text-text-muted' />
                  <span className='font-mono'>
                    {s.platform}: {s.url}
                  </span>
                  <ExternalLink size={10} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
