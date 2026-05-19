import { useCallback, useState } from 'react'
import { Globe, X } from 'lucide-react'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { Button } from '../ui/button'
import { SOCIAL_PLATFORMS, step6SocialsSchema } from '#/lib/sell-onboarding'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  website: <Globe size={16} />,
  instagram: <span className='text-xs font-bold'>IG</span>,
  pinterest: <span className='text-xs font-bold'>P</span>,
  tiktok: <span className='text-xs font-bold'>TT</span>,
  facebook: <span className='text-xs font-bold'>FB</span>,
  twitter: <span className='text-xs font-bold'>X</span>,
  youtube: <span className='text-xs font-bold'>YT</span>,
}

const PLATFORM_LABELS: Record<string, string> = {
  website: 'Website',
  instagram: 'Instagram',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  twitter: 'X / Twitter',
  youtube: 'YouTube',
}

export function Step6Socials() {
  const { saveStep, getStepData } = useOnboarding()
  const data = getStepData(6) as { socials: { platform: string; url: string }[] }

  const [socials, setSocials] = useState<{ platform: string; url: string }[]>(
    data.socials?.length > 0 ? data.socials : [],
  )
  const [newPlatform, setNewPlatform] = useState('')
  const [newUrl, setNewUrl] = useState('')

  const handleAdd = () => {
    if (newPlatform && newUrl) {
      setSocials([...socials, { platform: newPlatform, url: newUrl }])
      setNewPlatform('')
      setNewUrl('')
    }
  }

  const handleRemove = (index: number) => {
    setSocials(socials.filter((_, i) => i !== index))
  }

  const validate = useCallback(() => {
    const result = step6SocialsSchema.safeParse({ socials })
    return result.success
  }, [socials])

  const save = useCallback(async () => {
    await saveStep(6, { socials })
  }, [socials, saveStep])

  useStepActions(6, { validate, save })

  const usedPlatforms = new Set(socials.map((s) => s.platform))
  const availablePlatforms = SOCIAL_PLATFORMS.filter((p) => !usedPlatforms.has(p))

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='display-title text-2xl text-text-primary'>Socials & Links</h2>
        <p className='mt-1 text-text-secondary'>Connect your audience.</p>
      </div>

      <div className='rounded-lg border border-warning/20 bg-warning-subtle/30 p-3 text-sm text-warning'>
        Shops with at least one social link receive more first-month visits.
      </div>

      <div className='space-y-3'>
        {socials.map((social, idx) => (
          <div
            key={social.platform}
            className='flex items-center gap-3 rounded-lg border border-border-default bg-surface-default p-3'
          >
            <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-inset text-text-muted'>
              {PLATFORM_ICONS[social.platform]}
            </span>
            <div className='min-w-0 flex-1'>
              <p className='text-xs font-medium text-text-muted'>
                {PLATFORM_LABELS[social.platform]}
              </p>
              <p className='truncate text-sm text-text-primary'>{social.url}</p>
            </div>
            <button
              type='button'
              onClick={() => handleRemove(idx)}
              className='inline-flex items-center justify-center rounded-full p-1 text-text-muted transition hover:bg-surface-elevated hover:text-error'
              aria-label={`Remove ${social.platform}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {availablePlatforms.length > 0 && (
        <div className='space-y-3 rounded-xl border border-border-default p-4'>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div>
              <Label htmlFor='new-platform'>Platform</Label>
              <Select
                id='new-platform'
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                className='mt-1'
              >
                <option value=''>Select platform</option>
                {availablePlatforms.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor='new-url'>URL or handle</Label>
              <Input
                id='new-url'
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
            + Add link
          </Button>
        </div>
      )}
    </div>
  )
}
