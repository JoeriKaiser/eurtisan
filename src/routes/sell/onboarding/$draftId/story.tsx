import { createFileRoute } from '@tanstack/react-router'
import { Step2Story } from '#/components/sell/Step2Story'

export const Route = createFileRoute('/sell/onboarding/$draftId/story')({
  component: Step2Story,
})
