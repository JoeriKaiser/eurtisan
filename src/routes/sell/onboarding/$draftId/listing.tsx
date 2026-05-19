import { createFileRoute } from '@tanstack/react-router'
import { Step7Listing } from '#/components/sell/Step7Listing'

export const Route = createFileRoute('/sell/onboarding/$draftId/listing')({
  component: Step7RouteComponent,
})

function Step7RouteComponent() {
  return <Step7Listing />
}
