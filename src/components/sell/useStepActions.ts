import { useEffect } from 'react'
import { useOnboarding } from './OnboardingProvider'

export function useStepActions(
  step: number,
  actions: { validate: () => boolean; save: () => Promise<void> },
) {
  const { registerStepActions } = useOnboarding()

  useEffect(() => {
    registerStepActions(step, actions)
    return () => registerStepActions(step, null)
  }, [step, actions, registerStepActions])
}
