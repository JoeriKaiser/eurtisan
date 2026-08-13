import { useState } from 'react'
import { Globe, X } from 'lucide-react'
import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Select } from '#/components/ui/select'
import { SOCIAL_PLATFORMS, type SocialRow } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'

const PLATFORM_LABELS: Record<string, string> = {
  website: 'Website',
  instagram: 'Instagram',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  twitter: 'X / Twitter',
  youtube: 'YouTube',
}

interface ShopSettingsSocialsProps {
  socials: SocialRow[]
  onChange: (socials: SocialRow[]) => void
}

export function ShopSettingsSocials({ socials, onChange }: ShopSettingsSocialsProps) {
  const [newPlatform, setNewPlatform] = useState<(typeof SOCIAL_PLATFORMS)[number] | ''>('')
  const [newUrl, setNewUrl] = useState('')

  const usedPlatforms = new Set(socials.map((s) => s.platform))
  const availablePlatforms = SOCIAL_PLATFORMS.filter((p) => !usedPlatforms.has(p))

  const handleAdd = () => {
    if (!newPlatform || !newUrl) return
    onChange([...socials, { platform: newPlatform, url: newUrl.trim() }])
    setNewPlatform('')
    setNewUrl('')
  }

  const handleRemove = (index: number) => {
    onChange(socials.filter((_, i) => i !== index))
  }

  return (
    <div className='rounded-xl border border-border-subtle p-4'>
      <h3 className='mb-1 text-sm font-semibold text-text-primary'>
        {m.creator_shop_socials_title()}
      </h3>
      <p className='mb-3 text-xs text-text-muted'>{m.creator_shop_socials_description()}</p>

      <div className='space-y-3'>
        {socials.map((social, idx) => (
          <div
            key={`${social.platform}-${social.url}`}
            className='flex items-center gap-3 rounded-lg border border-border-default bg-surface-default p-3'
          >
            <span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-inset text-text-muted'>
              {social.platform === 'website' ? (
                <Globe size={14} />
              ) : (
                <span className='text-xs font-bold'>
                  {social.platform.slice(0, 2).toUpperCase()}
                </span>
              )}
            </span>
            <div className='min-w-0 flex-1'>
              <p className='text-xs font-medium text-text-muted'>
                {PLATFORM_LABELS[social.platform] ?? social.platform}
              </p>
              <p className='truncate text-sm text-text-primary'>{social.url}</p>
            </div>
            <button
              type='button'
              onClick={() => handleRemove(idx)}
              className='inline-flex items-center justify-center rounded-full p-1 text-text-muted transition hover:bg-surface-elevated hover:text-error'
              aria-label={m.creator_shop_socials_remove({
                platform: PLATFORM_LABELS[social.platform] ?? social.platform,
              })}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {availablePlatforms.length > 0 && (
        <div className='mt-3 space-y-3 rounded-lg border border-border-default p-3'>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div>
              <Label htmlFor='new-social-platform'>{m.creator_shop_socials_platform_label()}</Label>
              <Select
                id='new-social-platform'
                value={newPlatform}
                onChange={(e) =>
                  setNewPlatform(e.target.value as (typeof SOCIAL_PLATFORMS)[number] | '')
                }
                className='mt-1'
              >
                <option value=''>{m.creator_shop_socials_platform_placeholder()}</option>
                {availablePlatforms.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p] ?? p}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor='new-social-url'>{m.creator_shop_socials_url_label()}</Label>
              <Input
                id='new-social-url'
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={
                  newPlatform === 'website'
                    ? 'https://...'
                    : newPlatform === 'youtube'
                      ? 'youtube.com/...'
                      : '@handle'
                }
                className='mt-1'
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
              />
            </div>
          </div>
          <Button
            type='button'
            variant='secondary'
            onClick={handleAdd}
            disabled={!newPlatform || !newUrl}
          >
            {m.creator_shop_socials_add()}
          </Button>
        </div>
      )}
    </div>
  )
}
