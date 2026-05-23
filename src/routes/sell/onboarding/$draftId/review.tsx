import { createFileRoute } from '@tanstack/react-router'
import { Step8Review } from '#/components/sell/Step8Review'

export const Route = createFileRoute('/sell/onboarding/$draftId/review')({
  component: Step8Review,
})
