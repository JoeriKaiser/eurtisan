import { useLoaderData } from '@tanstack/react-router'
import { Printer, ArrowLeft, ShieldCheck } from 'lucide-react'
import { formatPriceEUR } from '#/lib/pricing'
import { formatDateLong } from '#/lib/format-date'

import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { m } from '#/paraglide/messages'
import type { InvoiceBillingDetails } from '#/lib/invoices'

function handlePrint() {
  window.print()
}

function hasZeroVatLine(details: InvoiceBillingDetails): boolean {
  return (
    details.items.some((item) => item.vatRateBasisPoints === 0) ||
    (details.shipping?.vatRateBasisPoints ?? 0) === 0
  )
}

export function InvoiceDetailComponent() {
  const { invoice } = useLoaderData({ from: '/invoices/$invoiceId' })
  const details = invoice.billingDetails

  const isPlatformFee = invoice.type === 'platform_fee'

  return (
    <div className='min-h-screen bg-bg-inset pb-16 print:bg-white print:pb-0'>
      {/* Top action bar - Hidden during print */}
      <div className='sticky top-0 z-40 border-b border-border-default bg-surface-default/80 backdrop-blur-md p-4 print:hidden'>
        <div className='mx-auto flex max-w-4xl items-center justify-between gap-4'>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => window.history.back()}
              aria-label='Go back'
            >
              <ArrowLeft size={16} />
            </Button>
            <div className='hidden sm:block'>
              <h1 className='text-sm font-semibold text-text-primary'>
                {isPlatformFee ? m.invoice_platform_fee_title() : m.invoice_customer_title()}
              </h1>
              <p className='text-xs text-text-muted'>{invoice.invoiceNumber}</p>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <Badge
              variant={isPlatformFee ? 'primary' : 'success'}
              className='font-medium capitalize'
            >
              {isPlatformFee ? m.invoice_platform_fee_badge() : m.invoice_customer_title()}
            </Badge>
            <Button
              variant='primary'
              onClick={handlePrint}
              className='flex items-center gap-2 shadow-sm font-medium'
            >
              <Printer size={16} />
              {m.invoice_print_button()}
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
                  <div className='flex size-16 items-center justify-center rounded-xl bg-gradient-to-tr from-accent-primary to-accent-secondary text-white font-bold text-lg shadow-md print:shadow-none'>
                    E
                  </div>
                  <span className='text-xl font-bold tracking-tight text-text-primary print:text-black'>
                    Eurtisan
                  </span>
                </div>
                <p className='text-xs text-text-muted print:text-gray-500'>{m.invoice_tagline()}</p>
              </div>

              <div className='text-left sm:text-right space-y-1.5'>
                <h2 className='text-lg font-bold tracking-tight text-text-primary print:text-black'>
                  {m.invoice_heading()}
                </h2>
                <div className='text-sm font-mono text-text-secondary print:text-gray-700'>
                  {m.invoice_number_prefix()}
                  <span className='font-bold text-text-primary print:text-black'>
                    {invoice.invoiceNumber}
                  </span>
                </div>
                <div className='text-xs text-text-muted print:text-gray-500'>
                  {m.invoice_date_prefix()}
                  {formatDateLong(invoice.createdAt)}
                </div>
                {details.reverseCharge && (
                  <Badge
                    variant='secondary'
                    className='mt-2 font-medium inline-flex items-center gap-1.5 print:border print:border-gray-400 print:text-black'
                  >
                    <ShieldCheck size={12} />
                    {m.invoice_reverse_charge()}
                  </Badge>
                )}
              </div>
            </div>

            {/* Addresses section: From & To */}
            <div className='grid grid-cols-1 gap-8 sm:grid-cols-2 py-8 border-b border-border-default'>
              <div className='space-y-3'>
                <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted print:text-gray-500'>
                  {isPlatformFee ? m.invoice_issuer_supplier() : m.invoice_issuer_seller()}
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
                      {m.invoice_vat_id()}
                      {details.from.vatId}
                    </p>
                  )}
                </div>
              </div>

              <div className='space-y-3'>
                <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted print:text-gray-500'>
                  {isPlatformFee ? m.invoice_customer_artisan() : m.invoice_buyer_customer()}
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
                      {m.invoice_vat_id()}
                      {details.to.vatId}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className='py-8'>
              <div className='overflow-x-auto'>
                <table className='w-full table-fixed text-left text-sm print:text-black'>
                  <thead>
                    <tr className='border-b border-border-default pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted print:text-gray-500'>
                      <th className='w-[32%] whitespace-nowrap px-2 pb-3 text-left font-medium print:whitespace-normal'>
                        {m.invoice_th_description()}
                      </th>
                      <th className='w-[10%] whitespace-nowrap px-2 pb-3 text-right font-medium print:whitespace-normal'>
                        {m.invoice_th_qty()}
                      </th>
                      <th className='w-[18%] whitespace-nowrap px-2 pb-3 text-right font-medium print:whitespace-normal'>
                        {m.invoice_th_unit_price()}
                      </th>
                      <th className='w-[12%] whitespace-nowrap px-2 pb-3 text-right font-medium print:whitespace-normal'>
                        {m.invoice_th_vat_rate()}
                      </th>
                      <th className='w-[14%] whitespace-nowrap px-2 pb-3 text-right font-medium print:whitespace-normal'>
                        {m.invoice_th_vat_amount()}
                      </th>
                      <th className='w-[14%] whitespace-nowrap px-2 pb-3 text-right font-medium print:whitespace-normal'>
                        {m.invoice_th_total()}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.items.map((item) => {
                      const vatRatePercent = (item.vatRateBasisPoints / 100).toFixed(1)
                      const unitPriceExcl = item.totalCents - item.vatAmountCents

                      return (
                        <tr
                          key={item.id}
                          className='border-b border-border-subtle hover:bg-bg-inset/50 print:border-gray-200'
                        >
                          <td className='px-2 py-4 font-medium text-text-primary print:text-black'>
                            {item.name}
                          </td>
                          <td className='px-2 py-4 text-right tabular-nums text-text-secondary print:text-black'>
                            {item.quantity}
                          </td>
                          <td className='px-2 py-4 text-right tabular-nums text-text-secondary print:text-black'>
                            {formatPriceEUR(unitPriceExcl / item.quantity)}
                          </td>
                          <td className='px-2 py-4 text-right tabular-nums text-text-secondary print:text-black'>
                            {vatRatePercent}%
                          </td>
                          <td className='px-2 py-4 text-right tabular-nums text-text-secondary print:text-black'>
                            {formatPriceEUR(item.vatAmountCents)}
                          </td>
                          <td className='px-2 py-4 text-right font-semibold tabular-nums text-text-primary print:text-black'>
                            {formatPriceEUR(item.totalCents)}
                          </td>
                        </tr>
                      )
                    })}

                    {/* Shipping Row for Customer Invoice */}
                    {!isPlatformFee && details.shipping && details.shipping.costCents > 0 && (
                      <tr className='border-b border-border-subtle print:border-gray-200'>
                        <td className='px-2 py-4 font-medium text-text-primary print:text-black'>
                          {m.invoice_shipping_delivery({ method: details.shipping.method })}
                        </td>
                        <td className='px-2 py-4 text-right tabular-nums text-text-secondary print:text-black'>
                          1
                        </td>
                        <td className='px-2 py-4 text-right tabular-nums text-text-secondary print:text-black'>
                          {formatPriceEUR(
                            details.shipping.costCents - details.shipping.vatAmountCents,
                          )}
                        </td>
                        <td className='px-2 py-4 text-right tabular-nums text-text-secondary print:text-black'>
                          {(details.shipping.vatRateBasisPoints / 100).toFixed(1)}%
                        </td>
                        <td className='px-2 py-4 text-right tabular-nums text-text-secondary print:text-black'>
                          {formatPriceEUR(details.shipping.vatAmountCents)}
                        </td>
                        <td className='px-2 py-4 text-right font-semibold tabular-nums text-text-primary print:text-black'>
                          {formatPriceEUR(details.shipping.costCents)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Inline VAT disclosure when any line shows 0% VAT */}
              {(details.reverseCharge ||
                !details.from.isVatRegistered ||
                hasZeroVatLine(details)) && (
                <div className='mt-4 rounded-lg border border-border-subtle bg-surface-inset p-3 text-xs text-text-secondary print:border-gray-200 print:bg-white'>
                  <p className='flex items-start gap-2'>
                    <ShieldCheck
                      size={14}
                      className='mt-0.5 shrink-0 text-accent-secondary'
                      aria-hidden='true'
                    />
                    {details.reverseCharge
                      ? m.invoice_reverse_charge_notice()
                      : !details.from.isVatRegistered
                        ? m.invoice_disclosure_customer_exempt()
                        : m.invoice_vat_zero_notice()}
                  </p>
                </div>
              )}
            </div>

            {/* Calculations Breakdown Summary & Disclosures */}
            <div className='flex flex-col gap-6 sm:flex-row sm:justify-between sm:items-start pt-8 border-t border-border-default'>
              <div className='max-w-md text-xs text-text-muted print:text-gray-500 space-y-2 leading-relaxed'>
                <h4 className='font-semibold uppercase tracking-wider text-text-primary print:text-black'>
                  {m.invoice_legal_disclosures_title()}
                </h4>
                {isPlatformFee ? (
                  <>
                    <p>{m.invoice_disclosure_platform_fee_desc({ operator: details.from.name })}</p>
                    {details.reverseCharge ? (
                      <p className='font-semibold text-warning-strong print:text-black'>
                        {m.invoice_disclosure_platform_fee_reverse()}
                      </p>
                    ) : (
                      <p className='font-semibold text-text-primary print:text-black'>
                        {m.invoice_disclosure_platform_fee_exempt()}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p>{m.invoice_disclosure_customer_desc()}</p>
                    {!details.from.isVatRegistered ? (
                      <div className='space-y-1'>
                        <p className='font-semibold'>{m.invoice_disclosure_customer_exempt()}</p>
                        {details.from.address.country?.toUpperCase() === 'FR' && (
                          <p className='font-semibold text-text-primary print:text-black mt-1'>
                            {m.invoice_disclosure_platform_fee_exempt()}
                          </p>
                        )}
                      </div>
                    ) : details.reverseCharge ? (
                      <p className='font-semibold text-warning-strong print:text-black'>
                        {m.invoice_disclosure_customer_reverse()}
                      </p>
                    ) : (
                      <p>{m.invoice_disclosure_customer_vat_desc()}</p>
                    )}
                  </>
                )}
              </div>

              <div className='w-full sm:w-80 shrink-0 space-y-3 text-sm text-text-secondary print:text-black'>
                <div className='flex justify-between'>
                  <span>{m.invoice_net_subtotal()}</span>
                  <span className='tabular-nums font-medium'>
                    {formatPriceEUR(invoice.subtotalCents)}
                  </span>
                </div>

                {/* VAT breakdown detail list */}
                <div className='space-y-1 border-b border-border-subtle pb-3 print:border-gray-200'>
                  <div className='flex justify-between text-xs text-text-muted print:text-gray-500'>
                    <span>{m.invoice_total_vat()}</span>
                    <span className='tabular-nums'>{formatPriceEUR(invoice.vatAmountCents)}</span>
                  </div>
                </div>

                <div className='flex justify-between text-base font-bold text-text-primary print:text-black'>
                  <span>{m.invoice_total_amount()}</span>
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
