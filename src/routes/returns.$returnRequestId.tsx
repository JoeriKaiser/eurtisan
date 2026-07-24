import { createFileRoute, notFound } from '@tanstack/react-router'
import { ReturnDetailPage } from '#/components/ReturnDetailPage'
import { getReturnRequest } from '#/lib/returns'

export const Route = createFileRoute('/returns/$returnRequestId')({
  loader: async ({ params }) => {
    const request = await getReturnRequest({
      data: { returnRequestId: params.returnRequestId },
    })
    if (!request) throw notFound()
    return { request }
  },
  component: ReturnDetailRoute,
})

function ReturnDetailRoute() {
  const { request } = Route.useLoaderData()
  return <ReturnDetailPage request={request} />
}
