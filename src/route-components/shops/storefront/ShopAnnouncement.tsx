import { Megaphone } from 'lucide-react'
import { m } from '#/paraglide/messages'

export interface ShopAnnouncementProps {
  announcement: string | null
}

/**
 * The maker's current notice — holiday closures, dispatch delays, restocks.
 *
 * Rendered as plain text. The stored value is seller-authored and is never
 * treated as markup.
 */
export function ShopAnnouncement({ announcement }: ShopAnnouncementProps) {
  const trimmed = announcement?.trim()
  if (!trimmed) return null

  return (
    <aside
      className='mt-6 flex gap-3 rounded-xl border border-accent-primary/15 bg-accent-primary-subtle/50 px-4 py-3'
      aria-label={m.shop_announcement_label()}
    >
      <Megaphone size={18} className='mt-0.5 shrink-0 text-accent-primary' aria-hidden='true' />
      <p className='m-0 whitespace-pre-line text-sm leading-relaxed text-text-secondary'>
        {trimmed}
      </p>
    </aside>
  )
}
