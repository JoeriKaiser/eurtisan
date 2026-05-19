import { useCallback, useState } from 'react'
import { Check, AlertTriangle, Edit3 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '../ui/button'
import { submitShopForReview } from '#/lib/sell-onboarding'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

export function Step8Review() {
  const { draft, saveStep } = useOnboarding()
  const navigate = useNavigate()
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = useCallback(() => {
    return termsAgreed
  }, [termsAgreed])

  const save = useCallback(async () => {
    await saveStep(8, { termsAgreed })
  }, [termsAgreed, saveStep])

  useStepActions(8, { validate, save })

  const handleSubmit = async () => {
    if (!termsAgreed) return
    setIsSubmitting(true)
    try {
      await submitShopForReview({ data: { draftId: draft.id } })
      navigate({ to: '/sell/status/$shopId', params: { shopId: draft.id } })
    } finally {
      setIsSubmitting(false)
    }
  }

  const checklist = [
    { label: 'Shop name & slug', ok: !!draft.name && !!draft.slug },
    { label: 'Category & production type', ok: !!draft.category && !!draft.productionType },
    { label: 'Description', ok: !!draft.description && draft.description.length >= 50 },
    { label: 'Shop icon', ok: !!draft.image },
    { label: 'Banner image', ok: !!draft.bannerImage, optional: true },
    { label: 'Shipping origin', ok: !!draft.shippingOrigin?.country },
    { label: 'Policies', ok: !!draft.policies, optional: true },
    { label: 'First listing', ok: true /* checked server-side */ },
    { label: 'Currency', ok: !!draft.currency },
  ]

  const sections = [
    {
      title: 'Identity',
      path: 'identity',
      content: (
        <div className='space-y-1 text-sm text-text-secondary'>
          <p>
            <span className='text-text-muted'>Name:</span> {draft.name}
          </p>
          <p>
            <span className='text-text-muted'>Slug:</span> {draft.slug}
          </p>
          {draft.tagline && (
            <p>
              <span className='text-text-muted'>Tagline:</span> {draft.tagline}
            </p>
          )}
          <p>
            <span className='text-text-muted'>Category:</span> {draft.category?.replace(/_/g, ' ')}
          </p>
          <p>
            <span className='text-text-muted'>Production:</span> {draft.productionType}
          </p>
        </div>
      ),
    },
    {
      title: 'Story',
      path: 'story',
      content: (
        <div className='space-y-1 text-sm text-text-secondary'>
          <p className='line-clamp-3'>{draft.description}</p>
          {draft.tags && draft.tags.length > 0 && (
            <p>
              <span className='text-text-muted'>Tags:</span> {draft.tags.join(', ')}
            </p>
          )}
        </div>
      ),
    },
    {
      title: 'Visuals',
      path: 'visuals',
      content: (
        <div className='flex gap-3'>
          {draft.image && (
            <img
              src={draft.image}
              alt='Shop icon'
              className='h-16 w-16 rounded-full object-cover'
            />
          )}
          {draft.bannerImage && (
            <img
              src={draft.bannerImage}
              alt='Banner'
              className='h-16 w-32 rounded-lg object-cover'
            />
          )}
        </div>
      ),
    },
    {
      title: 'Location',
      path: 'location',
      content: (
        <div className='space-y-1 text-sm text-text-secondary'>
          <p>{draft.shippingOrigin?.country}</p>
          {draft.shippingOrigin?.city && <p>{draft.shippingOrigin.city}</p>}
          <p>
            Processing: {draft.shippingOrigin?.processingTimeDays?.min}–
            {draft.shippingOrigin?.processingTimeDays?.max} days
          </p>
          <p>Currency: {draft.currency}</p>
        </div>
      ),
    },
    {
      title: 'Policies',
      path: 'policies',
      content: (
        <div className='text-sm text-text-secondary'>
          {draft.policies ? (
            <div className='space-y-1'>
              <p>Returns: {draft.policies.returns?.accepted ? 'Accepted' : 'Not accepted'}</p>
              <p>Exchanges: {draft.policies.exchanges?.accepted ? 'Accepted' : 'Not accepted'}</p>
              <p>
                Custom orders: {draft.policies.customOrders?.accepted ? 'Accepted' : 'Not accepted'}
              </p>
            </div>
          ) : (
            <p className='text-text-muted'>Not set — buyers will see "Contact seller"</p>
          )}
        </div>
      ),
    },
    {
      title: 'Socials',
      path: 'socials',
      content: (
        <div className='space-y-1 text-sm text-text-secondary'>
          {draft.socials?.length > 0 ? (
            draft.socials.map((s) => (
              <p key={s.id}>
                {s.platform}: {s.url}
              </p>
            ))
          ) : (
            <p className='text-text-muted'>None added</p>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='display-title text-2xl text-text-primary'>Review & Open Shop</h2>
        <p className='mt-1 text-text-secondary'>Everything looks great — let's make it official.</p>
      </div>

      {/* Checklist */}
      <div className='rounded-xl border border-border-default p-4'>
        <h3 className='mb-3 font-medium text-text-primary'>Checklist</h3>
        <div className='space-y-2'>
          {checklist.map((item) => (
            <div key={item.label} className='flex items-center gap-2 text-sm'>
              {item.ok ? (
                <Check size={16} className='text-success' />
              ) : item.optional ? (
                <AlertTriangle size={16} className='text-warning' />
              ) : (
                <span className='h-4 w-4 rounded-full border-2 border-error' />
              )}
              <span
                className={
                  item.ok
                    ? 'text-text-primary'
                    : item.optional
                      ? 'text-text-secondary'
                      : 'text-error'
                }
              >
                {item.label}
                {item.optional && <span className='text-text-muted'> (optional)</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className='space-y-4'>
        {sections.map((section) => (
          <div key={section.title} className='rounded-xl border border-border-default p-4'>
            <div className='mb-2 flex items-center justify-between'>
              <h3 className='font-medium text-text-primary'>{section.title}</h3>
              <button
                type='button'
                onClick={() =>
                  navigate({
                    to: `/sell/onboarding/$draftId/${section.path}` as '/sell/onboarding/$draftId/identity',
                    params: { draftId: draft.id },
                  })
                }
                className='flex items-center gap-1 text-sm text-accent-primary hover:underline'
              >
                <Edit3 size={14} />
                Edit
              </button>
            </div>
            {section.content}
          </div>
        ))}
      </div>

      {/* Terms */}
      <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
        <input
          id='terms'
          type='checkbox'
          checked={termsAgreed}
          onChange={(e) => setTermsAgreed(e.target.checked)}
          className='mt-1 h-4 w-4 rounded border-border-default text-accent-primary focus:ring-accent-secondary'
        />
        <label htmlFor='terms' className='text-sm text-text-secondary'>
          I agree to the{' '}
          <a
            href='/terms'
            target='_blank'
            rel='noopener noreferrer'
            className='text-accent-primary hover:underline'
          >
            Seller Terms of Service
          </a>{' '}
          and confirm that my shop complies with the platform's content policies.
        </label>
      </div>

      {/* Submit */}
      <Button
        variant='primary'
        className='w-full'
        disabled={!termsAgreed || isSubmitting}
        isLoading={isSubmitting}
        onClick={handleSubmit}
      >
        Submit for Review
      </Button>
    </div>
  )
}
