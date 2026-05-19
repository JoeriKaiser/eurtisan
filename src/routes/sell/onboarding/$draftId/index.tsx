import { createFileRoute, redirect } from '@tanstack/react-router'
import { getShopDraft } from '#/lib/sell-onboarding'

export const Route = createFileRoute('/sell/onboarding/$draftId/')({
  loader: async ({ params }) => {
    const draft = await getShopDraft({ data: { draftId: params.draftId } })
    const step = draft.onboardingStep ?? 1
    const stepPaths = [
      '/sell/onboarding/$draftId/identity',
      '/sell/onboarding/$draftId/story',
      '/sell/onboarding/$draftId/visuals',
      '/sell/onboarding/$draftId/location',
      '/sell/onboarding/$draftId/policies',
      '/sell/onboarding/$draftId/socials',
      '/sell/onboarding/$draftId/listing',
      '/sell/onboarding/$draftId/review',
    ] as const
    const target = stepPaths[Math.min(step - 1, stepPaths.length - 1)]
    throw redirect({ to: target, params: { draftId: draft.id } })
  },
})
