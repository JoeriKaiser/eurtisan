import { createFileRoute } from '@tanstack/react-router'
import { Step4Location } from '#/components/sell/Step4Location'

export const Route = createFileRoute('/sell/onboarding/$draftId/location')({
  component: Step4RouteComponent,
})

function Step4RouteComponent() {
  return <Step4Location />
}
