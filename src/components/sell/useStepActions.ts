import { useCallback, useRef, type RefCallback } from 'react'
import { useOnboarding } from './OnboardingProvider'

interface StepActions {
  validate: () => boolean
  save: () => Promise<void>
}

export function useStepActions(step: number, actions: StepActions): RefCallback<HTMLDivElement> {
  const { registerStepActions } = useOnboarding()
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  return useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return
      const registeredActions: StepActions = {
        validate: () => actionsRef.current.validate(),
        save: () => actionsRef.current.save(),
      }
      registerStepActions(step, registeredActions)
      return () => registerStepActions(step, null)
    },
    [registerStepActions, step],
  )
}
