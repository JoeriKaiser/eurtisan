import { createFileRoute, notFound } from '@tanstack/react-router'
import { getDisputeDetail } from '#/lib/disputes'
import { AdminDisputeDetailPage } from '#/route-components/admin/disputes/$disputeId'
import { AdminDisputeDetailPending } from '#/route-components/admin/disputes/$disputeId.pending'
import { AdminDisputeDetailError } from '#/route-components/admin/disputes/$disputeId.error'

export const Route = createFileRoute('/admin/disputes/$disputeId')({
  loader: async ({ params }) => {
    const dispute = await getDisputeDetail({ data: { disputeId: params.disputeId } }).catch(
      (err) => {
        if (err instanceof Response && err.status === 404) {
          throw notFound()
        }
        throw err
      },
    )
    if (!dispute) {
      throw notFound()
    }
    return { dispute }
  },
  head: () => ({
    meta: [{ title: 'Dispute Detail | Admin' }],
  }),
  component: AdminDisputeDetailPage,
  pendingComponent: AdminDisputeDetailPending,
  errorComponent: AdminDisputeDetailError,
})
