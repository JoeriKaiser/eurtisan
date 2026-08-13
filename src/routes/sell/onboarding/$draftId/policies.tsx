import { createFileRoute } from '@tanstack/react-router'
import { Step5Policies } from '#/components/sell/Step5Policies'

export const Route = createFileRoute('/sell/onboarding/$draftId/policies')({
  component: Step5Policies,
})
