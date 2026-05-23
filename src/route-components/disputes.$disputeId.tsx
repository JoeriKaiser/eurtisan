import DisputeThreadPage from '#/components/DisputeThreadPage'
import { useLoaderData } from '@tanstack/react-router'

export function DisputeRouteComponent() {
  const { dispute } = useLoaderData({ from: '/disputes/$disputeId' })
  return <DisputeThreadPage dispute={dispute} />
}
