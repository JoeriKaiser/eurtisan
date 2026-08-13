import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFoundPage } from '#/components/NotFoundPage'
import { getInvoiceData } from '#/lib/invoices'
import { InvoiceDetailComponent } from '#/route-components/invoices.$invoiceId'

export const Route = createFileRoute('/invoices/$invoiceId')({
  loader: async ({ params }) => {
    const result = (await getInvoiceData({
      data: { invoiceNumber: params.invoiceId },
    })) as Awaited<ReturnType<typeof getInvoiceData>> | Response
    if (result instanceof Response) {
      if (result.status === 404) {
        throw notFound()
      }
      throw result
    }
    return { invoice: result }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Invoice ${loaderData?.invoice?.invoiceNumber || ''} | Eurtisan` }],
  }),
  notFoundComponent: NotFoundPage,
  component: InvoiceDetailComponent,
})
