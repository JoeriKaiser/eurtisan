import { m } from '#/paraglide/messages'

interface ShopSettingsAnnouncementProps {
  value: string
  onChange: (value: string) => void
}

export function ShopSettingsAnnouncement({ value, onChange }: ShopSettingsAnnouncementProps) {
  return (
    <div className='rounded-xl border border-border-subtle p-4'>
      <label
        htmlFor='shop-announcement'
        className='mb-1 block text-sm font-semibold text-text-primary'
      >
        {m.creator_shop_announcement_label()}
      </label>
      <p className='mb-3 text-xs text-text-muted'>{m.creator_shop_announcement_description()}</p>
      <textarea
        id='shop-announcement'
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={m.creator_shop_announcement_placeholder()}
        className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20 resize-y'
        maxLength={500}
      />
      <p className='mt-1 text-right text-xs text-text-muted'>{value.length}/500</p>
    </div>
  )
}
