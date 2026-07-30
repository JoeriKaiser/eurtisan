import { Users } from 'lucide-react'
import type { ShopProfile } from '#/lib/shop-profile'
import { m } from '#/paraglide/messages'

export interface ShopStoryPanelProps {
  shop: ShopProfile
}

/**
 * The maker's own account of their work, plus the production-partner
 * disclosure.
 *
 * `hasProductionPartner` tells a buyer whether the maker produces the goods
 * themselves. On a marketplace whose purpose is connecting buyers with makers
 * that is one of the most consequential facts on the page, so it is stated
 * plainly whenever it is true rather than softened or buried.
 */
export function ShopStoryPanel({ shop }: ShopStoryPanelProps) {
  const description = shop.description?.trim()
  if (!description && !shop.hasProductionPartner) return null

  return (
    <section id='about' className='island-shell mt-8 scroll-mt-24 rounded-2xl px-6 py-8 sm:px-10'>
      <h2 className='mb-4 text-xl font-semibold text-text-primary'>{m.shop_about_heading()}</h2>

      {description && (
        <p className='m-0 max-w-2xl whitespace-pre-line text-base leading-relaxed text-text-secondary'>
          {description}
        </p>
      )}

      {shop.hasProductionPartner && (
        <div className='mt-6 flex gap-3 rounded-xl bg-surface-inset px-4 py-3'>
          <Users size={18} className='mt-0.5 shrink-0 text-text-muted' aria-hidden='true' />
          <div>
            <p className='m-0 text-sm font-medium text-text-primary'>
              {m.shop_production_partner_heading()}
            </p>
            {shop.productionPartnerDetails?.trim() && (
              <p className='m-0 mt-1 whitespace-pre-line text-sm leading-relaxed text-text-secondary'>
                {shop.productionPartnerDetails.trim()}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
