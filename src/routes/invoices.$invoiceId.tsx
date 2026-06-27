import { createFileRoute, notFound, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { getInvoiceData } from '#/lib/invoices'
import { guardAuth } from '#/lib/route-guards'
import { InvoiceDetailComponent } from '#/route-components/invoices.$invoiceId'

export const Route = createFileRoute('/invoices/$invoiceId')({
  beforeLoad: async () => guardAuth(),
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
  notFoundComponent: () => (
    <main className='page-wrap px-4 py-20 text-center'>
      <div className='mx-auto max-w-md'>
        <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
          Invoice Not Found
        </h1>
        <p className='mb-8 text-text-secondary'>
          We could not find the invoice you are looking for. It may not exist or you may not have
          permission to view it.
        </p>
        <Link
          to='/'
          className='inline-flex items-center gap-2 text-sm font-semibold text-accent-primary hover:underline'
        >
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>
    </main>
  ),
  component: InvoiceDetailComponent,
})
