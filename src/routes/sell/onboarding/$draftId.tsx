import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { OnboardingProvider } from '#/components/sell/OnboardingProvider'
import { WizardShell } from '#/components/sell/WizardShell'
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

function OnboardingLayout() {
  const { draft } = Route.useLoaderData()
  const [saveIndicator, setSaveIndicator] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  return (
    <OnboardingProvider draft={draft} onSaveStateChange={setSaveIndicator}>
      <WizardShell
        draftId={draft.id}
        currentStep={draft.onboardingStep}
        saveIndicator={saveIndicator}
      >
        <Outlet />
      </WizardShell>
    </OnboardingProvider>
  )
}
