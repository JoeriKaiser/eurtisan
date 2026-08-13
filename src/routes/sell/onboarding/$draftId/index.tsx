import { createFileRoute, redirect } from '@tanstack/react-router'
import { getShopDraft } from '#/lib/sell-onboarding'
import { normalizeOnboardingStage } from '#/lib/sell-onboarding-steps'

export const Route = createFileRoute('/sell/onboarding/$draftId/')({
  loader: async ({ params }) => {
    const draft = await getShopDraft({ data: { draftId: params.draftId } })
    const step = normalizeOnboardingStage(draft.onboardingStep ?? 1)
    const stepPaths = [
      '/sell/onboarding/$draftId/identity',
      '/sell/onboarding/$draftId/location',
      '/sell/onboarding/$draftId/listing',
      '/sell/onboarding/$draftId/policies',
      '/sell/onboarding/$draftId/review',
    ] as const
    const target = stepPaths[step - 1]
    throw redirect({ to: target, params: { draftId: draft.id } })
  },
})
