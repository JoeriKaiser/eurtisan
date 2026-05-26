import { Printer, ArrowLeft, ShieldCheck } from 'lucide-react'
import { formatPriceEUR } from '#/lib/pricing'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Route } from '#/routes/invoices.$invoiceId'

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

function parseSafeDate(val: any): Date {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (val && typeof val === 'object' && '$date' in val) {
    const d = new Date(val.$date)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

export function InvoiceDetailComponent() {
  const { invoice } = Route.useLoaderData()
  console.log('CLIENT INVOICE DATA:', JSON.stringify(invoice, null, 2))
  const details = invoice.billingDetails as any

  const handlePrint = () => {
    window.print()
  }

  const isPlatformFee = invoice.type === 'platform_fee'

  return (
    <div className='min-h-screen bg-bg-inset pb-16 print:bg-white print:pb-0'>
      {/* Top action bar - Hidden during print */}
      <div className='sticky top-0 z-40 border-b border-border-default bg-surface-default/80 backdrop-blur-md p-4 print:hidden'>
        <div className='mx-auto flex max-w-4xl items-center justify-between gap-4'>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => window.history.back()}
              className='inline-flex size-9 items-center justify-center rounded-lg border border-border-default bg-surface-default text-text-secondary transition hover:text-text-primary hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
              aria-label='Go back'
            >
              <ArrowLeft size={16} />
            </button>
            <div className='hidden sm:block'>
              <h1 className='text-sm font-semibold text-text-primary'>
                {isPlatformFee ? 'Platform Fee Invoice' : 'Customer Invoice'}
              </h1>
              <p className='text-xs text-text-muted'>{invoice.invoiceNumber}</p>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <Badge
              variant={isPlatformFee ? 'primary' : 'success'}
              className='font-medium capitalize'
            >
              {isPlatformFee ? 'Platform Fee' : 'Customer Invoice'}
            </Badge>
            <Button
              variant='primary'
              onClick={handlePrint}
              className='flex items-center gap-2 shadow-sm font-medium'
            >
              <Printer size={16} />
              Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Main Invoice Sheet Container */}
      <main className='mx-auto mt-6 max-w-4xl px-4 sm:px-6 print:mt-0 print:px-0'>
        <Card className='relative overflow-hidden border border-border-default bg-surface-default shadow-lg print:border-0 print:bg-white print:shadow-none'>
          {/* Decorative Top Line - Hidden during print */}
          <div className='absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-accent-primary to-accent-secondary print:hidden' />

          <CardContent className='p-8 sm:p-12 print:p-0'>
            {/* Header: Logo and Invoice Meta details */}
            <div className='flex flex-col gap-6 sm:flex-row sm:justify-between sm:items-start border-b border-border-default pb-8'>
              <div>
                {/* Visual Identity Logo */}
                <div className='flex items-center gap-2.5 mb-3'>
                  <div className='flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-accent-primary to-accent-secondary text-white font-bold text-lg shadow-md print:shadow-none'>
                    E
                  </div>
                  <span className='text-xl font-bold tracking-tight text-text-primary print:text-black'>
                    Eurtisan
                  </span>
                </div>
                <p className='text-xs text-text-muted print:text-gray-500'>
                  Europe's Artisan & Maker Marketplace
                </p>
              </div>

              <div className='text-left sm:text-right space-y-1.5'>
                <h2 className='text-lg font-bold tracking-tight text-text-primary print:text-black'>
                  INVOICE
                </h2>
                <div className='text-sm font-mono text-text-secondary print:text-gray-700'>
                  Number:{' '}
                  <span className='font-bold text-text-primary print:text-black'>
                    {invoice.invoiceNumber}
                  </span>
                </div>
                <div className='text-xs text-text-muted print:text-gray-500'>
                  Date: {DATE_FORMATTER.format(parseSafeDate(invoice.createdAt))}
                </div>
                {isPlatformFee && details.reverseCharge && (
                  <Badge
                    variant='warning'
                    className='mt-2 font-medium inline-flex items-center gap-1.5 print:border print:border-gray-400 print:text-black'
                  >
                    <ShieldCheck size={12} />
                    Reverse Charge
                  </Badge>
                )}
              </div>
            </div>

            {/* Addresses section: From & To */}
            <div className='grid grid-cols-1 gap-8 sm:grid-cols-2 py-8 border-b border-border-default'>
              <div className='space-y-3'>
                <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted print:text-gray-500'>
                  {isPlatformFee ? 'Issuer (Supplier)' : 'Seller (on behalf of Artisan)'}
                </h3>
                <div className='text-sm text-text-secondary print:text-black space-y-1'>
                  <p className='font-bold text-text-primary print:text-black'>
                    {details.from.name}
                  </p>
                  {details.from.email && <p>{details.from.email}</p>}
                  {details.from.address.street && <p>{details.from.address.street}</p>}
                  <p>
                    {details.from.address.postalCode} {details.from.address.city}
                  </p>
                  <p className='font-medium'>{details.from.address.country}</p>
                  {details.from.vatId && (
                    <p className='mt-2 text-xs font-mono text-text-muted print:text-gray-600'>
                      VAT ID: {details.from.vatId}
                    </p>
                  )}
                </div>
              </div>

              <div className='space-y-3'>
                <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted print:text-gray-500'>
                  {isPlatformFee ? 'Customer (Artisan)' : 'Buyer (Customer)'}
                </h3>
                <div className='text-sm text-text-secondary print:text-black space-y-1'>
                  <p className='font-bold text-text-primary print:text-black'>{details.to.name}</p>
                  {details.to.email && <p>{details.to.email}</p>}
                  {details.to.address.street && <p>{details.to.address.street}</p>}
                  <p>
                    {details.to.address.postalCode} {details.to.address.city}
                  </p>
                  <p className='font-medium'>{details.to.address.country}</p>
                  {details.to.vatId && (
                    <p className='mt-2 text-xs font-mono text-text-muted print:text-gray-600'>
                      VAT ID: {details.to.vatId}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className='py-8'>
              <div className='overflow-x-auto'>
                <table className='w-full text-left text-sm print:text-black'>
                  <thead>
                    <tr className='border-b border-border-default pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted print:text-gray-500'>
                      <th className='pb-3 font-medium'>Description</th>
                      <th className='pb-3 text-right font-medium'>Qty</th>
                      <th className='pb-3 text-right font-medium'>Unit Price (excl. VAT)</th>
                      <th className='pb-3 text-right font-medium'>VAT Rate</th>
                      <th className='pb-3 text-right font-medium'>VAT Amount</th>
                      <th className='pb-3 text-right font-medium'>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.items.map((item: any) => {
                      const vatRatePercent = (item.vatRateBasisPoints / 100).toFixed(1)
                      const unitPriceExcl = item.totalCents - item.vatAmountCents

                      return (
                        <tr
                          key={item.id}
                          className='border-b border-border-subtle hover:bg-bg-inset/50 print:border-gray-200'
                        >
                          <td className='py-4 font-medium text-text-primary print:text-black'>
                            {item.name}
                          </td>
                          <td className='py-4 text-right tabular-nums text-text-secondary print:text-black'>
                            {item.quantity}
                          </td>
                          <td className='py-4 text-right tabular-nums text-text-secondary print:text-black'>
                            {formatPriceEUR(unitPriceExcl / item.quantity)}
                          </td>
                          <td className='py-4 text-right tabular-nums text-text-secondary print:text-black'>
                            {vatRatePercent}%
                          </td>
                          <td className='py-4 text-right tabular-nums text-text-secondary print:text-black'>
                            {formatPriceEUR(item.vatAmountCents)}
                          </td>
                          <td className='py-4 text-right font-semibold tabular-nums text-text-primary print:text-black'>
                            {formatPriceEUR(item.totalCents)}
                          </td>
                        </tr>
                      )
                    })}

                    {/* Shipping Row for Customer Invoice */}
                    {!isPlatformFee && details.shipping && details.shipping.costCents > 0 && (
                      <tr className='border-b border-border-subtle print:border-gray-200'>
                        <td className='py-4 font-medium text-text-primary print:text-black'>
                          Shipping & Delivery ({details.shipping.method})
                        </td>
                        <td className='py-4 text-right tabular-nums text-text-secondary print:text-black'>
                          1
                        </td>
                        <td className='py-4 text-right tabular-nums text-text-secondary print:text-black'>
                          {formatPriceEUR(
                            details.shipping.costCents - details.shipping.vatAmountCents,
                          )}
                        </td>
                        <td className='py-4 text-right tabular-nums text-text-secondary print:text-black'>
                          {(details.shipping.vatRateBasisPoints / 100).toFixed(1)}%
                        </td>
                        <td className='py-4 text-right tabular-nums text-text-secondary print:text-black'>
                          {formatPriceEUR(details.shipping.vatAmountCents)}
                        </td>
                        <td className='py-4 text-right font-semibold tabular-nums text-text-primary print:text-black'>
                          {formatPriceEUR(details.shipping.costCents)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations Breakdown Summary & Disclosures */}
            <div className='flex flex-col gap-6 sm:flex-row sm:justify-between sm:items-start pt-8 border-t border-border-default'>
              <div className='max-w-md text-xs text-text-muted print:text-gray-500 space-y-2 leading-relaxed'>
                <h4 className='font-semibold uppercase tracking-wider text-text-primary print:text-black'>
                  Legal Disclosures & Notes
                </h4>
                {isPlatformFee ? (
                  <>
                    <p>
                      This invoice represents the platform fee commission charged by Joeri Kaiser
                      (Eurtisan) to the artisan. Amounts are automatically settled via split payment
                      transactions.
                    </p>
                    {details.reverseCharge ? (
                      <p className='font-semibold text-warning-strong print:text-black'>
                        Reverse charge: Customer to account for VAT under Art 44 of the VAT
                        Directive / Autoliquidation : Art. 283 du CGI.
                      </p>
                    ) : (
                      <p className='font-semibold text-text-primary print:text-black'>
                        TVA non applicable, article 293 B du CGI.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      This invoice is issued by Eurtisan on behalf of the Artisan Shop owner. The
                      seller of record is the Artisan Shop named under the issuer section.
                    </p>
                    {!details.from.isVatRegistered ? (
                      <p className='font-semibold'>
                        VAT Exempt: Artisan is registered as a small business under EU Article
                        281-294 and does not charge VAT on sales.
                      </p>
                    ) : (
                      <p>
                        VAT rates are computed based on the destination principle (OSS) using the
                        shipping destination.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className='w-full sm:w-80 shrink-0 space-y-3 text-sm text-text-secondary print:text-black'>
                <div className='flex justify-between'>
                  <span>Net Subtotal:</span>
                  <span className='tabular-nums font-medium'>
                    {formatPriceEUR(invoice.subtotalCents)}
                  </span>
                </div>

                {/* VAT breakdown detail list */}
                <div className='space-y-1 border-b border-border-subtle pb-3 print:border-gray-200'>
                  <div className='flex justify-between text-xs text-text-muted print:text-gray-500'>
                    <span>Total VAT:</span>
                    <span className='tabular-nums'>{formatPriceEUR(invoice.vatAmountCents)}</span>
                  </div>
                </div>

                <div className='flex justify-between text-base font-bold text-text-primary print:text-black'>
                  <span>Total Amount (incl. VAT):</span>
                  <span className='tabular-nums'>{formatPriceEUR(invoice.totalCents)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
