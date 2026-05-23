import { createFileRoute, redirect } from '@tanstack/react-router'
import { OnboardingLayout } from '#/route-components/sell/onboarding/$draftId'
import { getShopDraft } from '#/lib/sell-onboarding'
import { guardAuth } from '#/lib/route-guards'

export const Route = createFileRoute('/sell/onboarding/$draftId')({
  beforeLoad: async () => {
    await guardAuth()
  },
  loader: async ({ params }) => {
    const draft = await getShopDraft({ data: { draftId: params.draftId } })
    if (draft.status === 'active' || draft.status === 'pending_review') {
      throw redirect({ to: '/sell/status/$shopId', params: { shopId: params.draftId } })
    }
    return { draft }
  },
  component: OnboardingLayout,
})
