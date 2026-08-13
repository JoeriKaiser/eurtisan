import DisputeThreadPage from '#/components/DisputeThreadPage'
import { useLoaderData } from '@tanstack/react-router'

export function DisputeRouteComponent() {
  const { dispute } = useLoaderData({ from: '/disputes/$disputeId' })
  const stateKey = `${dispute.status}:${dispute.messages.map((message) => message.id).join(',')}`
  return <DisputeThreadPage key={stateKey} dispute={dispute} />
}
