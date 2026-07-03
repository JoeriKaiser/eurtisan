import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFoundPage } from '#/components/NotFoundPage'
import { DisputeThreadError, DisputeThreadLoading } from '#/components/DisputeThreadPage'
import { DisputeRouteComponent } from '#/route-components/disputes.$disputeId'
import { getDisputeDetail } from '#/lib/disputes'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/disputes/$disputeId')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    const dispute = await getDisputeDetail({
      data: { disputeId: params.disputeId },
    }).catch((err) => {
      if (err instanceof Response && err.status === 404) {
        throw notFound()
      }
      throw err
    })
    if (!dispute) {
      throw notFound()
    }
    return { dispute }
  },
  head: () => ({
    meta: [
      { title: `${m.dispute_title()} | Eurtisan` },
      { name: 'description', content: m.dispute_title() },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: DisputeRouteComponent,
  pendingComponent: DisputeThreadLoading,
  errorComponent: DisputeThreadError,
})
