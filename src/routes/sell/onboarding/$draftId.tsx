import { createFileRoute, redirect } from '@tanstack/react-router'
import { OnboardingLayout } from '#/route-components/sell/onboarding/$draftId'
import { getOnboardingListing, getOnboardingReadiness, getShopDraft } from '#/lib/sell-onboarding'
import { listCategories } from '#/lib/categories'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'
import { OnboardingError } from '#/route-components/sell/onboarding/OnboardingError'
import { OnboardingPending } from '#/route-components/sell/onboarding/OnboardingPending'

export const Route = createFileRoute('/sell/onboarding/$draftId')({
  head: () => ({
    meta: [
      { title: m.onboarding_meta_title() },
      { name: 'description', content: m.onboarding_meta_description() },
    ],
  }),
  beforeLoad: async () => {
    await guardAuth()
  },
  loader: async ({ params }) => {
    const draft = await getShopDraft({ data: { draftId: params.draftId } })
    if (
      draft.status === 'active' ||
      draft.status === 'pending_review' ||
      draft.status === 'approved'
    ) {
      throw redirect({ to: '/sell/status/$shopId', params: { shopId: params.draftId } })
    }
    const [listing, readiness, categories] = await Promise.all([
      getOnboardingListing({ data: { draftId: params.draftId } }),
      getOnboardingReadiness({ data: { draftId: params.draftId } }),
      listCategories({ data: { tree: false } }),
    ])
    return { draft, listing, readiness, categories }
  },
  component: OnboardingLayout,
  pendingComponent: OnboardingPending,
  errorComponent: OnboardingError,
})
