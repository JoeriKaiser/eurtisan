import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/sell/onboarding/$draftId/socials')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/sell/onboarding/$draftId/identity',
      params: { draftId: params.draftId },
      replace: true,
    })
  },
})
