import { Badge } from '#/components/ui/badge'
import type { ShopDraft } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'

interface ShopIdentitySectionProps {
  details: ShopDraft
}

export function ShopIdentitySection({ details }: ShopIdentitySectionProps) {
  return (
    <div className='space-y-2'>
      <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
        {m.admin_shops_application_section_identity()}
      </h3>
      <div className='bg-surface-inset rounded-xl p-4 space-y-3 border border-border-subtle'>
        <div>
          <p className='text-xs text-text-muted'>{m.admin_shops_col_name()}</p>
          <p className='text-sm font-semibold text-text-primary'>{details.name}</p>
        </div>
        <div>
          <p className='text-xs text-text-muted'>Slug</p>
          <p className='text-sm font-mono text-text-primary'>/shops/{details.slug}</p>
        </div>
        {details.tagline && (
          <div>
            <p className='text-xs text-text-muted'>{m.admin_shops_application_field_tagline()}</p>
            <p className='text-sm text-text-primary'>{details.tagline}</p>
          </div>
        )}
        {details.category && (
          <div>
            <p className='text-xs text-text-muted'>{m.admin_shops_application_field_category()}</p>
            <Badge variant='secondary' className='mt-0.5'>
              {details.category}
            </Badge>
          </div>
        )}
        {details.tags.length > 0 && (
          <div>
            <p className='text-xs text-text-muted'>{m.admin_shops_application_field_tags()}</p>
            <div className='flex flex-wrap gap-1 mt-1'>
              {details.tags.map((t: string) => (
                <Badge key={t} variant='outline'>
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
