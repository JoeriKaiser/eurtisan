import { createFileRoute } from '@tanstack/react-router'
import { Step1Identity } from '#/components/sell/Step1Identity'

export const Route = createFileRoute('/sell/onboarding/$draftId/identity')({
  component: Step1RouteComponent,
})

function Step1RouteComponent() {
  return <Step1Identity />
}
