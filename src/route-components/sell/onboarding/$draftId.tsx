import { Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import { OnboardingProvider } from '#/components/sell/OnboardingProvider'
import { WizardShell } from '#/components/sell/WizardShell'
import { useLoaderData } from '@tanstack/react-router'

export function OnboardingLayout() {
  const { draft } = useLoaderData({ from: '/sell/onboarding/$draftId' })
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
