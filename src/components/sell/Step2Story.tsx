import { useCallback, useState } from 'react'
import { X } from 'lucide-react'
import { step2StorySchema } from '#/lib/sell-onboarding'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Switch } from '../ui/switch'
import { Textarea } from '../ui/textarea'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

const STARTER_PROMPTS = [
  'My shop specialises in…',
  'Each item is made by hand using…',
  'I started this shop because…',
]

export function Step2Story() {
  const { saveStep, getStepData } = useOnboarding()
  const data = getStepData(2) as {
    description: string
    tags: string[]
    languages: string[]
    hasProductionPartner: boolean
    productionPartnerDetails: string
  }

  const [form, setForm] = useState({
    description: data.description ?? '',
    tags: data.tags ?? ([] as string[]),
    languages: data.languages ?? ([] as string[]),
    hasProductionPartner: data.hasProductionPartner ?? false,
    productionPartnerDetails: data.productionPartnerDetails ?? '',
  })
  const [inputs, setInputs] = useState({ tagInput: '', langInput: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleAddTag = () => {
    const trimmed = inputs.tagInput.trim().toLowerCase()
    if (trimmed && !form.tags.includes(trimmed) && form.tags.length < 13) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }))
      setInputs((prev) => ({ ...prev, tagInput: '' }))
    }
  }

  const handleRemoveTag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
  }

  const handleAddLanguage = () => {
    const trimmed = inputs.langInput.trim()
    if (trimmed && !form.languages.includes(trimmed)) {
      setForm((prev) => ({ ...prev, languages: [...prev.languages, trimmed] }))
      setInputs((prev) => ({ ...prev, langInput: '' }))
    }
  }

  const handleRemoveLanguage = (lang: string) => {
    setForm((prev) => ({ ...prev, languages: prev.languages.filter((l) => l !== lang) }))
  }

  const validate = useCallback(() => {
    const result = step2StorySchema.safeParse({
      description: form.description,
      tags: form.tags,
      languages: form.languages,
      hasProductionPartner: form.hasProductionPartner,
      productionPartnerDetails: form.productionPartnerDetails,
    })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string
        fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return false
    }
    setErrors({})
    return true
  }, [form])

  const save = useCallback(async () => {
    await saveStep(2, {
      description: form.description,
      tags: form.tags,
      languages: form.languages,
      hasProductionPartner: form.hasProductionPartner,
      productionPartnerDetails: form.productionPartnerDetails,
    })
  }, [form, saveStep])

  useStepActions(2, { validate, save })

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='display-title text-2xl text-text-primary'>Tell Your Story</h2>
        <p className='mt-1 text-text-secondary'>
          Help buyers understand what makes your shop special.
        </p>
      </div>

      {/* Description */}
      <div>
        <Label htmlFor='shop-description' required>
          Shop description
        </Label>
        <div className='mb-2 mt-1 flex flex-wrap gap-2'>
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type='button'
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  description: prev.description ? `${prev.description}\n\n${prompt}` : prompt,
                }))
              }
              className='rounded-full border border-border-default bg-surface-default px-3 py-1 text-xs text-text-secondary shadow-sm transition hover:scale-[1.02] hover:border-accent-primary hover:bg-accent-primary/5 hover:text-accent-primary duration-fast ease-out'
            >
              {prompt}
            </button>
          ))}
        </div>
        <Textarea
          id='shop-description'
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          rows={8}
          maxLength={5000}
          placeholder='Describe your shop, your process, and what buyers can expect...'
          error={errors.description}
        />
        <div className='mt-1 flex items-center justify-between text-xs text-text-muted'>
          <span className='text-error'>{errors.description}</span>
          <span className='rounded border border-border-subtle bg-surface-inset px-2 py-0.5 font-mono text-[10px] font-medium text-text-secondary shadow-sm'>
            {form.description.length} / 5000
          </span>
        </div>
      </div>

      {/* Tags */}
      <div>
        <Label htmlFor='shop-tags'>Tags</Label>
        <div className='mt-1 flex gap-2'>
          <Input
            id='shop-tags'
            value={inputs.tagInput}
            onChange={(e) => setInputs((prev) => ({ ...prev, tagInput: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTag()
              }
            }}
            maxLength={20}
            placeholder='Add a tag and press Enter'
          />
          <Button type='button' variant='secondary' onClick={handleAddTag}>
            Add
          </Button>
        </div>
        <p className='mt-1 text-xs text-text-muted'>Up to 13 tags, max 20 characters each</p>
        <div className='mt-2 flex flex-wrap gap-2'>
          {form.tags.map((tag) => (
            <Badge key={tag} variant='default' className='gap-1 pr-1.5'>
              {tag}
              <button
                type='button'
                onClick={() => handleRemoveTag(tag)}
                className='inline-flex items-center justify-center rounded-full p-0.5 text-text-muted transition hover:bg-surface-elevated hover:text-error'
                aria-label={`Remove ${tag}`}
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div>
        <Label htmlFor='shop-languages'>Languages you communicate in</Label>
        <div className='mt-1 flex gap-2'>
          <Input
            id='shop-languages'
            value={inputs.langInput}
            onChange={(e) => setInputs((prev) => ({ ...prev, langInput: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddLanguage()
              }
            }}
            placeholder='e.g. English, French'
          />
          <Button type='button' variant='secondary' onClick={handleAddLanguage}>
            Add
          </Button>
        </div>
        <div className='mt-2 flex flex-wrap gap-2'>
          {form.languages.map((lang) => (
            <Badge key={lang} variant='default' className='gap-1 pr-1.5'>
              {lang}
              <button
                type='button'
                onClick={() => handleRemoveLanguage(lang)}
                className='inline-flex items-center justify-center rounded-full p-0.5 text-text-muted transition hover:bg-surface-elevated hover:text-error'
                aria-label={`Remove ${lang}`}
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Production Partner */}
      <div className='rounded-xl border border-border-default p-4'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='production-partner'>I work with a production partner</Label>
          <Switch
            id='production-partner'
            checked={form.hasProductionPartner}
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, hasProductionPartner: checked }))
            }
          />
        </div>
        {form.hasProductionPartner && (
          <div className='mt-3'>
            <Label htmlFor='partner-details'>
              What does your production partner do?{' '}
              <span className='text-text-muted'>(not shown publicly)</span>
            </Label>
            <Input
              id='partner-details'
              value={form.productionPartnerDetails}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, productionPartnerDetails: e.target.value }))
              }
              maxLength={500}
              placeholder='e.g. A local print shop handles screen printing'
              className='mt-1'
            />
          </div>
        )}
      </div>
    </div>
  )
}
