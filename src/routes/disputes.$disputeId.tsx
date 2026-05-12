import { createFileRoute, notFound } from '@tanstack/react-router'
import DisputeThreadPage, {
  DisputeThreadError,
  DisputeThreadLoading,
} from '#/components/DisputeThreadPage'
import { getDisputeDetail } from '#/lib/disputes'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/disputes/$disputeId')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    try {
      const dispute = await getDisputeDetail({
        data: { disputeId: params.disputeId },
      })
      if (!dispute) {
        throw notFound()
      }
      return { dispute }
    } catch (err) {
      if (err instanceof Response && err.status === 404) {
        throw notFound()
      }
      throw err
    }
  },
  head: () => ({
    meta: [
      { title: `${m.dispute_title()} | Eurtisan` },
      { name: 'description', content: m.dispute_title() },
    ],
  }),
  notFoundComponent: () => (
    <main className='page-wrap px-4 py-20 text-center'>
      <div className='mx-auto max-w-md'>
        <h1 className='display-title mb-2 text-2xl font-bold text-text-primary'>
          {m.dispute_not_found()}
        </h1>
        <p className='mb-8 text-text-secondary'>{m.error_not_found_description()}</p>
      </div>
    </main>
  ),
  component: DisputeRouteComponent,
  pendingComponent: DisputeThreadLoading,
  errorComponent: DisputeThreadError,
})

function DisputeRouteComponent() {
  const { dispute } = Route.useLoaderData()
  return <DisputeThreadPage dispute={dispute} />
}
