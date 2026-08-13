import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Download, FileText } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Select } from '#/components/ui/select'
import { Label } from '#/components/ui/label'
import { getShopTaxReport, type ShopTaxReport } from '#/lib/tax-report'
import { formatPriceEUR } from '#/lib/pricing'
import { formatDateShort } from '#/lib/format-date'
import { generateCSV, downloadCSV } from '#/lib/csv-export'

interface ShopTaxReportPageProps {
  initialReport: ShopTaxReport
}

function formatRate(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`
}

function formatCountryName(countryCode: string): string {
  if (!countryCode) return countryCode
  try {
    const locale = getLocale()
    return new Intl.DisplayNames(locale, { type: 'region' }).of(countryCode) ?? countryCode
  } catch {
    return countryCode
  }
}

function monthLabel(month: number): string {
  try {
    const locale = getLocale()
    return new Date(2000, month - 1, 1).toLocaleDateString(locale, { month: 'long' })
  } catch {
    return new Date(2000, month - 1, 1).toLocaleDateString('en', { month: 'long' })
  }
}

function buildExportFilename(period: ShopTaxReport['period']): string {
  return period.month
    ? `tax-report-${period.year}-${String(period.month).padStart(2, '0')}.csv`
    : `tax-report-${period.year}.csv`
}

function exportJSON(report: ShopTaxReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = report.period.month
    ? `tax-report-${report.period.year}-${String(report.period.month).padStart(2, '0')}.json`
    : `tax-report-${report.period.year}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function exportCSV(report: ShopTaxReport): void {
  const vatRows = report.vatByCountryRate.map((row) => ({
    section: m.tax_report_csv_section_vat_collected(),
    buyerCountry: row.buyerCountry,
    vatRateBasisPoints: row.vatRateBasisPoints,
    netSubtotalCents: row.netSubtotalCents,
    vatAmountCents: row.vatAmountCents,
    transactionCount: row.transactionCount,
  }))

  const reverseChargeRows = report.reverseCharge.transactionCount
    ? [
        {
          section: m.tax_report_csv_section_reverse_charge(),
          buyerCountry: '',
          vatRateBasisPoints: '',
          netSubtotalCents: report.reverseCharge.netSubtotalCents,
          vatAmountCents: '',
          transactionCount: report.reverseCharge.transactionCount,
        },
      ]
    : []

  const platformFeeRows = report.platformFee.feeTotalCents
    ? [
        {
          section: m.tax_report_csv_section_platform_fee(),
          buyerCountry: '',
          vatRateBasisPoints: '',
          netSubtotalCents: report.platformFee.feeSubtotalCents,
          vatAmountCents: report.platformFee.feeVatCents,
          transactionCount: report.platformFee.reverseChargeCount,
        },
      ]
    : []

  const invoiceRows = report.recentInvoices.map((invoice) => ({
    section: m.tax_report_csv_section_recent_invoice(),
    buyerCountry: '',
    vatRateBasisPoints: '',
    netSubtotalCents: invoice.subtotalCents,
    vatAmountCents: invoice.vatAmountCents,
    transactionCount: invoice.invoiceNumber,
  }))

  const rows = [...vatRows, ...reverseChargeRows, ...platformFeeRows, ...invoiceRows]
  const csv = generateCSV(rows, [
    { key: 'section', label: m.tax_report_csv_col_section() },
    { key: 'buyerCountry', label: m.tax_report_csv_col_buyer_country() },
    { key: 'vatRateBasisPoints', label: m.tax_report_csv_col_vat_rate_basis_points() },
    { key: 'netSubtotalCents', label: m.tax_report_csv_col_net_subtotal_cents() },
    { key: 'vatAmountCents', label: m.tax_report_csv_col_vat_amount_cents() },
    { key: 'transactionCount', label: m.tax_report_csv_col_transaction_count() },
  ])
  downloadCSV(csv, buildExportFilename(report.period))
}

export function ShopTaxReportPage({ initialReport }: ShopTaxReportPageProps) {
  const [report, setReport] = useState<ShopTaxReport>(initialReport)
  const [period, setPeriod] = useState<ShopTaxReport['period']>(initialReport.period)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestVersionRef = useRef(0)

  const currentYear = new Date().getFullYear()
  const years = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
  }, [currentYear])

  const loadReport = useCallback(
    async (nextPeriod: ShopTaxReport['period']) => {
      const requestVersion = ++requestVersionRef.current
      setPeriod(nextPeriod)
      setIsLoading(true)
      setError(null)
      try {
        const nextReport = await getShopTaxReport({
          data: {
            shopId: initialReport.shopId,
            year: nextPeriod.year,
            month: nextPeriod.month,
          },
        })
        if (requestVersion !== requestVersionRef.current) return
        setReport(nextReport)
        setPeriod(nextReport.period)
      } catch (err) {
        if (requestVersion === requestVersionRef.current) {
          setError(err instanceof Error ? err.message : m.tax_report_error())
        }
      } finally {
        if (requestVersion === requestVersionRef.current) setIsLoading(false)
      }
    },
    [initialReport.shopId],
  )

  const lifecycleOwnerRef = useCallback((node: HTMLElement | null) => {
    if (!node) return
    return () => {
      requestVersionRef.current++
    }
  }, [])

  const handleYearChange = (value: string) => {
    void loadReport({ ...period, year: Number.parseInt(value, 10) })
  }

  const handleMonthChange = (value: string) => {
    const nextPeriod =
      value === 'annual'
        ? { year: period.year }
        : { year: period.year, month: Number.parseInt(value, 10) }
    void loadReport(nextPeriod)
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section ref={lifecycleOwnerRef} className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
              {m.tax_report_title()}
            </h1>
            <p className='text-text-secondary'>{m.tax_report_description()}</p>
          </div>

          <div className='flex flex-col gap-3 sm:min-w-[280px]'>
            <span className='text-sm font-medium text-text-primary'>
              {m.tax_report_period_label()}
            </span>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <Label htmlFor='tax-report-year' className='sr-only'>
                  {m.tax_report_year_label()}
                </Label>
                <Select
                  id='tax-report-year'
                  value={String(period.year)}
                  onChange={(e) => handleYearChange(e.target.value)}
                  disabled={isLoading}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor='tax-report-month' className='sr-only'>
                  {m.tax_report_month_label()}
                </Label>
                <Select
                  id='tax-report-month'
                  value={period.month ? String(period.month) : 'annual'}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  disabled={isLoading}
                >
                  <option value='annual'>{m.tax_report_month_annual()}</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {monthLabel(month)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>

        {isLoading && (
          <p className='py-4 text-text-secondary' aria-live='polite'>
            {m.tax_report_loading()}
          </p>
        )}

        {error && (
          <p className='py-4 text-error' aria-live='polite'>
            {error}
          </p>
        )}

        {!isLoading && !error && (
          <>
            {/* DAC7 status */}
            <Card className='mb-6'>
              <CardHeader>
                <div className='flex flex-wrap items-center gap-3'>
                  <FileText size={20} aria-hidden='true' />
                  <CardTitle>{m.tax_report_dac7_title()}</CardTitle>
                  {report.dac7Status.exceededLimit && (
                    <Badge variant='error'>{m.tax_report_dac7_warning_exceeded()}</Badge>
                  )}
                  {!report.dac7Status.exceededLimit && report.dac7Status.approachingLimit && (
                    <Badge variant='warning'>{m.tax_report_dac7_warning_approaching()}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div>
                    <p className='text-sm text-text-secondary'>
                      {report.dac7Status.transactionCount === 1
                        ? m.tax_report_dac7_transactions_single()
                        : m.tax_report_dac7_transactions({
                            count: report.dac7Status.transactionCount,
                          })}
                    </p>
                    <p className='text-sm text-text-secondary'>
                      {m.tax_report_dac7_gross_sales({
                        amount: formatPriceEUR(report.dac7Status.grossSalesCents),
                      })}
                    </p>
                  </div>
                  {!report.dac7IdentityComplete && (
                    <div className='rounded-lg border border-warning/20 bg-warning-subtle p-3'>
                      <p className='mb-2 text-sm text-warning'>{m.tax_report_dac7_incomplete()}</p>
                      <Link
                        to='/creator/shop'
                        search={{ shopId: report.shopId }}
                        className='text-sm font-medium text-accent-secondary hover:underline'
                      >
                        {m.tax_report_dac7_settings_link()}
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* VAT collected */}
            <Card className='mb-6'>
              <CardHeader>
                <CardTitle>{m.tax_report_vat_title()}</CardTitle>
              </CardHeader>
              <CardContent>
                {report.vatByCountryRate.length === 0 ? (
                  <p className='text-text-secondary'>{m.tax_report_vat_empty()}</p>
                ) : (
                  <div className='overflow-x-auto'>
                    <table
                      className='w-full min-w-[600px] text-sm'
                      aria-label={m.tax_report_vat_title()}
                    >
                      <thead>
                        <tr className='border-b border-border-default text-left text-text-secondary'>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_vat_col_country()}
                          </th>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_vat_col_rate()}
                          </th>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_vat_col_net()}
                          </th>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_vat_col_vat()}
                          </th>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_vat_col_transactions()}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.vatByCountryRate.map((row) => (
                          <tr
                            key={`${row.buyerCountry}-${row.vatRateBasisPoints}`}
                            className='border-b border-border-subtle last:border-b-0'
                          >
                            <td className='py-3 pr-4 text-text-primary'>
                              {formatCountryName(row.buyerCountry)}
                            </td>
                            <td className='py-3 pr-4 text-text-primary'>
                              {formatRate(row.vatRateBasisPoints)}
                            </td>
                            <td className='py-3 pr-4 text-text-primary'>
                              {formatPriceEUR(row.netSubtotalCents)}
                            </td>
                            <td className='py-3 pr-4 text-text-primary'>
                              {formatPriceEUR(row.vatAmountCents)}
                            </td>
                            <td className='py-3 pr-4 text-text-primary'>{row.transactionCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reverse charge and platform fee */}
            <div className='mb-6 grid gap-4 sm:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle>{m.tax_report_reverse_charge_title()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-text-secondary'>
                    {report.reverseCharge.transactionCount === 1
                      ? m.tax_report_reverse_charge_count_one()
                      : m.tax_report_reverse_charge_count_other({
                          count: report.reverseCharge.transactionCount,
                        })}
                  </p>
                  <p className='text-lg font-semibold text-text-primary'>
                    {m.tax_report_reverse_charge_net({
                      amount: formatPriceEUR(report.reverseCharge.netSubtotalCents),
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{m.tax_report_platform_fee_title()}</CardTitle>
                </CardHeader>
                <CardContent className='space-y-1'>
                  <p className='text-text-secondary'>
                    {m.tax_report_platform_fee_total()}:{' '}
                    <span className='font-medium text-text-primary'>
                      {formatPriceEUR(report.platformFee.feeTotalCents)}
                    </span>
                  </p>
                  <p className='text-text-secondary'>
                    {m.tax_report_platform_fee_vat()}:{' '}
                    <span className='font-medium text-text-primary'>
                      {formatPriceEUR(report.platformFee.feeVatCents)}
                    </span>
                  </p>
                  <p className='text-text-secondary'>
                    {m.tax_report_platform_fee_reverse_charge()}:{' '}
                    <span className='font-medium text-text-primary'>
                      {formatPriceEUR(report.platformFee.reverseChargeSubtotalCents)}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent invoices */}
            <Card className='mb-6'>
              <CardHeader>
                <CardTitle>{m.tax_report_invoices_title()}</CardTitle>
              </CardHeader>
              <CardContent>
                {report.recentInvoices.length === 0 ? (
                  <p className='text-text-secondary'>{m.tax_report_invoices_empty()}</p>
                ) : (
                  <div className='overflow-x-auto'>
                    <table
                      className='w-full min-w-[600px] text-sm'
                      aria-label={m.tax_report_invoices_title()}
                    >
                      <thead>
                        <tr className='border-b border-border-default text-left text-text-secondary'>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_invoices_col_number()}
                          </th>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_invoices_col_type()}
                          </th>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_invoices_col_date()}
                          </th>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_invoices_col_subtotal()}
                          </th>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_invoices_col_vat()}
                          </th>
                          <th scope='col' className='py-2 pr-4 font-medium'>
                            {m.tax_report_invoices_col_total()}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.recentInvoices.map((invoice) => (
                          <tr
                            key={invoice.invoiceNumber}
                            className='border-b border-border-subtle last:border-b-0'
                          >
                            <td className='py-3 pr-4'>
                              <Link
                                to='/invoices/$invoiceId'
                                params={{ invoiceId: invoice.invoiceNumber }}
                                className='font-medium text-accent-secondary hover:underline'
                              >
                                {invoice.invoiceNumber}
                              </Link>
                            </td>
                            <td className='py-3 pr-4 text-text-primary'>
                              {invoice.type === 'customer'
                                ? m.tax_report_invoices_type_customer()
                                : m.tax_report_invoices_type_platform_fee()}
                            </td>
                            <td className='py-3 pr-4 text-text-primary'>
                              {formatDateShort(invoice.createdAt)}
                            </td>
                            <td className='py-3 pr-4 text-text-primary'>
                              {formatPriceEUR(invoice.subtotalCents)}
                            </td>
                            <td className='py-3 pr-4 text-text-primary'>
                              {formatPriceEUR(invoice.vatAmountCents)}
                            </td>
                            <td className='py-3 pr-4 text-text-primary'>
                              {formatPriceEUR(invoice.totalCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Export actions */}
            <div className='flex flex-wrap gap-3'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => exportJSON(report)}
                aria-label={m.tax_report_export_json()}
              >
                <FileText size={16} aria-hidden='true' />
                {m.tax_report_export_json()}
              </Button>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => exportCSV(report)}
                aria-label={m.tax_report_export_csv()}
              >
                <Download size={16} aria-hidden='true' />
                {m.tax_report_export_csv()}
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
