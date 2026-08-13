import { ExternalLink } from 'lucide-react'
import type { ShopSocialLink } from '#/lib/shop-profile'
import { m } from '#/paraglide/messages'
import { isSafeHttpUrl, socialPlatformLabel } from './labels'

export interface ShopSocialLinksProps {
  socials: readonly ShopSocialLink[]
}

/**
 * Off-platform links the maker has published.
 *
 * `rel="nofollow ugc"` because these are user-generated and must not pass
 * ranking signal; `noopener noreferrer` because they open in a new tab. The
 * scheme is re-checked here even though the projection already filtered it —
 * this is the layer closest to the DOM and a stored `javascript:` URL is an
 * XSS vector.
 */
export function ShopSocialLinks({ socials }: ShopSocialLinksProps) {
  const safe = socials.filter((social) => isSafeHttpUrl(social.url))
  if (safe.length === 0) return null

  return (
    <section className='island-shell mt-8 rounded-2xl px-6 py-8 sm:px-10'>
      <h2 className='mb-4 text-xl font-semibold text-text-primary'>{m.shop_socials_heading()}</h2>
      <ul className='flex flex-wrap gap-2'>
        {safe.map((social) => (
          <li key={social.platform}>
            <a
              href={social.url}
              target='_blank'
              rel='nofollow ugc noopener noreferrer'
              className='inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-secondary no-underline transition-colors hover:border-accent-primary/30 hover:text-accent-primary'
            >
              {/* The platform name is visible text, not only an icon: meaning
                  must never depend on iconography alone. */}
              {socialPlatformLabel(social.platform)}
              <ExternalLink size={14} aria-hidden='true' />
              <span className='sr-only'>({m.shop_link_new_tab()})</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
