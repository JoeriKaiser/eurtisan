import { createFileRoute } from '@tanstack/react-router'
import { Step3Visuals } from '#/components/sell/Step3Visuals'

export const Route = createFileRoute('/sell/onboarding/$draftId/visuals')({
  component: Step3RouteComponent,
})

function Step3RouteComponent() {
  return <Step3Visuals />
}
