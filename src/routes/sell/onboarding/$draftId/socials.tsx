import { createFileRoute } from '@tanstack/react-router'
import { Step6Socials } from '#/components/sell/Step6Socials'

export const Route = createFileRoute('/sell/onboarding/$draftId/socials')({
  component: Step6RouteComponent,
})

function Step6RouteComponent() {
  return <Step6Socials />
}
