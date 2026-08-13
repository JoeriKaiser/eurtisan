import { Link, useLoaderData, useNavigate, useRouter } from '@tanstack/react-router'
import {
  Check,
  Circle,
  ExternalLink,
  LockKeyhole,
  SearchCheck,
  Store,
  WalletCards,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'
import { FeedbackBanner } from '../ui/FeedbackBanner'
import { getImageUrl } from '#/lib/image-url'
import { formatPriceEUR } from '#/lib/pricing'
import { SELLER_TERMS_VERSION, submitShopForReview } from '#/lib/sell-onboarding'
import { trackEvent } from '#/integrations/umami'
import { m } from '#/paraglide/messages'
import { useOnboarding } from './OnboardingProvider'

const readinessLabels = {
  profile: () => m.onboarding_readiness_profile(),
  seller: () => m.onboarding_readiness_seller(),
  product: () => m.onboarding_readiness_product(),
  delivery: () => m.onboarding_readiness_delivery(),
}

export function Step8Review() {
  const { draft, readiness, listing } = useLoaderData({ from: '/sell/onboarding/$draftId' })
  const navigate = useNavigate()
  const router = useRouter()
  const { runSave } = useOnboarding()
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!termsAgreed || !readiness.ready) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await runSave(() =>
        submitShopForReview({
          data: {
            draftId: draft.id,
            termsAgreed: true,
            termsVersion: SELLER_TERMS_VERSION,
          },
        }),
      )
      void trackEvent('seller_onboarding_submitted', { stageCount: 5 })
      await router.invalidate()
      await navigate({ to: '/sell/status/$shopId', params: { shopId: draft.id } })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setSubmitError(
        message.startsWith('INCOMPLETE_ONBOARDING')
          ? m.onboarding_submit_incomplete()
          : m.onboarding_submit_failed(),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='space-y-8'>
      <header>
        <p className='text-sm font-medium text-accent-primary'>{m.onboarding_stage_review()}</p>
        <h1 className='display-title mt-1 text-2xl text-text-primary'>
          {m.onboarding_review_title()}
        </h1>
        <p className='mt-2 max-w-[65ch] text-text-secondary'>{m.onboarding_review_description()}</p>
      </header>

      {submitError && <FeedbackBanner type='error' message={submitError} />}

      <section
        className='rounded-xl border border-border-default p-4'
        aria-labelledby='readiness-title'
      >
        <div className='flex items-center justify-between gap-4'>
          <h2 id='readiness-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_readiness_title()}
          </h2>
          <span
            className={`text-sm font-medium ${readiness.ready ? 'text-success' : 'text-warning'}`}
          >
            {readiness.ready ? m.onboarding_ready_to_submit() : m.onboarding_needs_attention()}
          </span>
        </div>
        <ul className='mt-4 divide-y divide-border-subtle'>
          {readiness.items.map(
            (item: {
              id: keyof typeof readinessLabels
              path: 'identity' | 'location' | 'listing' | 'policies'
              complete: boolean
            }) => (
              <li key={item.id} className='flex min-h-12 items-center justify-between gap-4 py-2'>
                <span className='flex items-center gap-3 text-sm text-text-primary'>
                  {item.complete ? (
                    <Check className='size-5 text-success' aria-hidden='true' />
                  ) : (
                    <Circle className='size-5 text-error' aria-hidden='true' />
                  )}
                  {readinessLabels[item.id]()}
                </span>
                {!item.complete && (
                  <Link
                    to={
                      `/sell/onboarding/$draftId/${item.path}` as '/sell/onboarding/$draftId/identity'
                    }
                    params={{ draftId: draft.id }}
                    className='inline-flex min-h-11 items-center text-sm font-medium text-accent-primary hover:underline'
                  >
                    {m.onboarding_complete_section()}
                  </Link>
                )}
              </li>
            ),
          )}
        </ul>
      </section>

      <section aria-labelledby='preview-title'>
        <div className='flex items-end justify-between gap-4'>
          <div>
            <h2 id='preview-title' className='text-lg font-semibold text-text-primary'>
              {m.onboarding_buyer_preview()}
            </h2>
            <p className='mt-1 text-sm text-text-secondary'>{m.onboarding_buyer_preview_hint()}</p>
          </div>
          <span className='hidden text-xs text-text-muted sm:block'>
            eurtisan.eu/shops/{draft.slug}
          </span>
        </div>
        <div className='mt-4 overflow-hidden rounded-2xl border border-border-default bg-surface-default'>
          <div className='grid gap-5 border-b border-border-default bg-surface-inset p-5 sm:grid-cols-[5rem_1fr] sm:items-center'>
            <div className='flex size-20 items-center justify-center overflow-hidden rounded-xl bg-surface-default'>
              {draft.image ? (
                <img src={getImageUrl(draft.image)} alt='' className='size-full object-cover' />
              ) : (
                <Store className='size-8 text-text-muted' aria-hidden='true' />
              )}
            </div>
            <div>
              <p className='text-xl font-semibold text-text-primary'>
                {draft.name || m.onboarding_untitled_shop()}
              </p>
              {draft.tagline && <p className='mt-1 text-sm text-text-secondary'>{draft.tagline}</p>}
              <p className='mt-2 line-clamp-2 text-sm text-text-muted'>{draft.description}</p>
            </div>
          </div>
          {listing ? (
            <article className='grid gap-4 p-5 sm:grid-cols-[8rem_1fr]'>
              <div className='aspect-square overflow-hidden rounded-xl bg-surface-inset'>
                {listing.images[0] ? (
                  <img
                    src={getImageUrl(listing.images[0].key)}
                    alt={listing.images[0].altText ?? listing.name}
                    className='size-full object-cover'
                  />
                ) : null}
              </div>
              <div>
                <p className='font-semibold text-text-primary'>{listing.name}</p>
                <p className='mt-1 line-clamp-2 text-sm text-text-secondary'>
                  {listing.description}
                </p>
                <p className='mt-3 font-semibold text-text-primary'>
                  {formatPriceEUR(listing.priceCents)}
                </p>
                <p className='mt-1 text-xs text-text-muted'>
                  {m.onboarding_preview_stock({ count: String(listing.stockCount) })}
                </p>
              </div>
            </article>
          ) : (
            <div className='p-5 text-sm text-text-muted'>{m.onboarding_preview_no_product()}</div>
          )}
        </div>
      </section>

      <section
        className='space-y-4 border-t border-border-default pt-8'
        aria-labelledby='launch-title'
      >
        <div>
          <h2 id='launch-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_after_submit_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary'>
            {m.onboarding_after_submit_description()}
          </p>
        </div>
        <ol className='grid gap-3 sm:grid-cols-3'>
          <li className='flex gap-3 rounded-xl bg-surface-inset p-4'>
            <SearchCheck className='size-5 shrink-0 text-accent-primary' aria-hidden='true' />
            <div>
              <p className='text-sm font-semibold text-text-primary'>
                {m.onboarding_launch_review()}
              </p>
              <p className='mt-1 text-xs text-text-muted'>{m.onboarding_launch_review_hint()}</p>
            </div>
          </li>
          <li className='flex gap-3 rounded-xl bg-surface-inset p-4'>
            <LockKeyhole className='size-5 shrink-0 text-accent-primary' aria-hidden='true' />
            <div>
              <p className='text-sm font-semibold text-text-primary'>
                {m.onboarding_launch_secure()}
              </p>
              <p className='mt-1 text-xs text-text-muted'>{m.onboarding_launch_secure_hint()}</p>
            </div>
          </li>
          <li className='flex gap-3 rounded-xl bg-surface-inset p-4'>
            <WalletCards className='size-5 shrink-0 text-accent-primary' aria-hidden='true' />
            <div>
              <p className='text-sm font-semibold text-text-primary'>
                {m.onboarding_launch_payments()}
              </p>
              <p className='mt-1 text-xs text-text-muted'>{m.onboarding_launch_payments_hint()}</p>
            </div>
          </li>
        </ol>
      </section>

      <section className='space-y-4 rounded-xl border border-border-default p-4'>
        <label htmlFor='seller-terms' className='flex min-h-11 cursor-pointer items-start gap-3'>
          <input
            id='seller-terms'
            type='checkbox'
            checked={termsAgreed}
            onChange={(event) => setTermsAgreed(event.target.checked)}
            className='mt-0.5 size-5 accent-[var(--ds-accent-primary)]'
          />
          <span className='text-sm text-text-secondary'>
            {m.onboarding_terms_agreement()}{' '}
            <Link
              to='/terms'
              target='_blank'
              className='font-medium text-accent-primary hover:underline'
            >
              {m.onboarding_seller_terms_link()}{' '}
              <ExternalLink className='inline size-3' aria-hidden='true' />
            </Link>
          </span>
        </label>
        <Button
          variant='primary'
          className='min-h-12 w-full'
          disabled={!termsAgreed || !readiness.ready || isSubmitting}
          isLoading={isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {m.onboarding_submit_for_review()}
        </Button>
        {!readiness.ready && (
          <p className='text-center text-xs text-text-muted'>
            {m.onboarding_complete_before_submit()}
          </p>
        )}
      </section>
    </div>
  )
}
