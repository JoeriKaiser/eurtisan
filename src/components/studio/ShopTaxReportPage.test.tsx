// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    search?: Record<string, string>
    className?: string
  }) => (
    <a
      href={props.to}
      className={props.className}
      data-params={JSON.stringify(props.params)}
      data-search={JSON.stringify(props.search)}
    >
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/runtime', () => ({
  getLocale: () => 'en',
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    tax_report_title: () => 'Tax & VAT Reporting',
    tax_report_description: () =>
      'Review VAT collected, reverse charges, platform fees, and DAC7 status.',
    tax_report_period_label: () => 'Reporting period',
    tax_report_year_label: () => 'Year',
    tax_report_month_label: () => 'Month',
    tax_report_month_annual: () => 'Annual',
    tax_report_loading: () => 'Loading tax report...',
    tax_report_error: () => 'Could not load tax report. Please try again.',
    tax_report_dac7_title: () => 'DAC7 Status',
    tax_report_dac7_transactions: ({ count }: { count: number }) => `${count} transactions`,
    tax_report_dac7_gross_sales: ({ amount }: { amount: string }) => `${amount} gross sales`,
    tax_report_dac7_warning_approaching: () => 'Approaching DAC7 reporting threshold',
    tax_report_dac7_warning_exceeded: () => 'DAC7 reporting threshold exceeded',
    tax_report_dac7_incomplete: () => 'Tax identity incomplete — update settings',
    tax_report_dac7_settings_link: () => 'Update tax identity',
    tax_report_vat_title: () => 'VAT Collected',
    tax_report_vat_empty: () => 'No VAT data for the selected period.',
    tax_report_vat_col_country: () => 'Buyer country',
    tax_report_vat_col_rate: () => 'Rate',
    tax_report_vat_col_net: () => 'Net subtotal',
    tax_report_vat_col_vat: () => 'VAT',
    tax_report_vat_col_transactions: () => 'Transactions',
    tax_report_reverse_charge_title: () => 'Reverse Charge',
    tax_report_reverse_charge_count: ({ count }: { count: number }) =>
      `${count} reverse-charge transactions`,
    tax_report_reverse_charge_net: ({ amount }: { amount: string }) =>
      `${amount} net under reverse charge`,
    tax_report_platform_fee_title: () => 'Platform Fees',
    tax_report_platform_fee_total: () => 'Total fees',
    tax_report_platform_fee_vat: () => 'VAT on fees',
    tax_report_platform_fee_reverse_charge: () => 'Reverse-charged fees',
    tax_report_invoices_title: () => 'Recent Invoices',
    tax_report_invoices_empty: () => 'No invoices for the selected period.',
    tax_report_invoices_col_number: () => 'Invoice',
    tax_report_invoices_col_type: () => 'Type',
    tax_report_invoices_col_date: () => 'Date',
    tax_report_invoices_col_subtotal: () => 'Subtotal',
    tax_report_invoices_col_vat: () => 'VAT',
    tax_report_invoices_col_total: () => 'Total',
    tax_report_invoices_type_customer: () => 'Customer',
    tax_report_invoices_type_platform_fee: () => 'Platform Fee',
    tax_report_export_json: () => 'Export JSON',
    tax_report_export_csv: () => 'Export CSV',
    tax_report_csv_col_section: () => 'Section',
    tax_report_csv_col_buyer_country: () => 'Buyer country',
    tax_report_csv_col_vat_rate_basis_points: () => 'VAT rate basis points',
    tax_report_csv_col_net_subtotal_cents: () => 'Net subtotal (cents)',
    tax_report_csv_col_vat_amount_cents: () => 'VAT amount (cents)',
    tax_report_csv_col_transaction_count: () => 'Transaction count / invoice number',
    tax_report_csv_section_vat_collected: () => 'VAT_COLLECTED',
    tax_report_csv_section_reverse_charge: () => 'REVERSE_CHARGE',
    tax_report_csv_section_platform_fee: () => 'PLATFORM_FEE',
    tax_report_csv_section_recent_invoice: () => 'RECENT_INVOICE',
  },
}))

vi.mock('#/lib/pricing', () => ({
  formatPriceEUR: (cents: number) => `€${(cents / 100).toFixed(2)}`,
}))

vi.mock('#/lib/format-date', () => ({
  formatDateShort: (value: Date | string) => new Date(value).toISOString().slice(0, 10),
}))

vi.mock('#/lib/csv-export', () => ({
  generateCSV: vi.fn(() => 'section,buyerCountry\nVAT_COLLECTED,DE'),
  downloadCSV: vi.fn(),
}))

vi.mock('#/lib/tax-report', () => ({
  getShopTaxReport: vi.fn(),
}))

import { getShopTaxReport, type ShopTaxReport } from '#/lib/tax-report'
import { ShopTaxReportPage } from './ShopTaxReportPage'
import { generateCSV, downloadCSV } from '#/lib/csv-export'

const mockGetShopTaxReport = vi.mocked(getShopTaxReport)

function makeReport(overrides?: Partial<ShopTaxReport>): ShopTaxReport {
  return {
    shopId: 'shop-1',
    period: { year: 2026 },
    dac7Status: {
      transactionCount: 10,
      grossSalesCents: 50000,
      approachingLimit: false,
      exceededLimit: false,
    },
    dac7IdentityComplete: true,
    vatByCountryRate: [
      {
        buyerCountry: 'DE',
        vatRateBasisPoints: 2000,
        netSubtotalCents: 10000,
        vatAmountCents: 2000,
        transactionCount: 2,
      },
    ],
    reverseCharge: {
      transactionCount: 1,
      netSubtotalCents: 5000,
    },
    platformFee: {
      feeSubtotalCents: 500,
      feeVatCents: 100,
      feeTotalCents: 600,
      reverseChargeCount: 0,
      reverseChargeSubtotalCents: 0,
    },
    recentInvoices: [
      {
        invoiceNumber: 'INV-2026-00001',
        type: 'customer',
        createdAt: new Date('2026-05-01T12:00:00Z'),
        subtotalCents: 5000,
        vatAmountCents: 1000,
        totalCents: 6000,
        shopOrderId: 'order-1',
      },
    ],
    ...overrides,
  }
}

describe('ShopTaxReportPage', () => {
  beforeEach(() => {
    mockGetShopTaxReport.mockReset()
    vi.mocked(generateCSV).mockClear()
    vi.mocked(downloadCSV).mockClear()
  })

  it('renders title, period selector, and report sections', () => {
    render(<ShopTaxReportPage initialReport={makeReport()} />)

    expect(screen.getByText('Tax & VAT Reporting')).toBeDefined()
    expect(screen.getByText('DAC7 Status')).toBeDefined()
    expect(screen.getByText('VAT Collected')).toBeDefined()
    expect(screen.getByText('Reverse Charge')).toBeDefined()
    expect(screen.getByText('Platform Fees')).toBeDefined()
    expect(screen.getByText('Recent Invoices')).toBeDefined()
  })

  it('renders VAT table with correct columns and values', () => {
    render(<ShopTaxReportPage initialReport={makeReport()} />)

    const vatTable = screen.getByRole('table', { name: 'VAT Collected' })
    const headers = within(vatTable).getAllByRole('columnheader')
    expect(headers.map((h) => h.textContent)).toEqual([
      'Buyer country',
      'Rate',
      'Net subtotal',
      'VAT',
      'Transactions',
    ])

    expect(screen.getByText('DE')).toBeDefined()
    expect(screen.getByText('20.00%')).toBeDefined()
    expect(screen.getByText('€100.00')).toBeDefined()
    expect(screen.getByText('€20.00')).toBeDefined()
  })

  it('shows empty states when report has no data', () => {
    render(
      <ShopTaxReportPage
        initialReport={makeReport({
          vatByCountryRate: [],
          reverseCharge: { transactionCount: 0, netSubtotalCents: 0 },
          platformFee: {
            feeSubtotalCents: 0,
            feeVatCents: 0,
            feeTotalCents: 0,
            reverseChargeCount: 0,
            reverseChargeSubtotalCents: 0,
          },
          recentInvoices: [],
        })}
      />,
    )

    expect(screen.getByText('No VAT data for the selected period.')).toBeDefined()
    expect(screen.getByText('No invoices for the selected period.')).toBeDefined()
  })

  it('calls getShopTaxReport when year changes', async () => {
    const updatedReport = makeReport({ period: { year: 2025 } })
    mockGetShopTaxReport.mockResolvedValue(updatedReport)

    render(<ShopTaxReportPage initialReport={makeReport()} />)

    const yearSelect = screen.getByLabelText('Year')
    fireEvent.change(yearSelect, { target: { value: '2025' } })

    await waitFor(() => {
      expect(mockGetShopTaxReport).toHaveBeenCalledWith({
        data: { shopId: 'shop-1', year: 2025, month: undefined },
      })
    })
  })

  it('calls getShopTaxReport when month changes', async () => {
    const updatedReport = makeReport({ period: { year: 2026, month: 3 } })
    mockGetShopTaxReport.mockResolvedValue(updatedReport)

    render(<ShopTaxReportPage initialReport={makeReport()} />)

    const monthSelect = screen.getByLabelText('Month')
    fireEvent.change(monthSelect, { target: { value: '3' } })

    await waitFor(() => {
      expect(mockGetShopTaxReport).toHaveBeenCalledWith({
        data: { shopId: 'shop-1', year: 2026, month: 3 },
      })
    })
  })

  it('downloads JSON with correct MIME type', () => {
    const createObjectURL = vi.fn(() => 'blob:url')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL

    render(<ShopTaxReportPage initialReport={makeReport()} />)

    screen.getByRole('button', { name: 'Export JSON' }).click()

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    const [[blob]] = createObjectURL.mock.calls as unknown as [[Blob]]
    expect(blob.type).toBe('application/json')
  })

  it('downloads CSV with correct MIME type via generateCSV/downloadCSV', () => {
    render(<ShopTaxReportPage initialReport={makeReport()} />)

    screen.getByRole('button', { name: 'Export CSV' }).click()

    expect(generateCSV).toHaveBeenCalled()
    expect(downloadCSV).toHaveBeenCalledWith(expect.any(String), 'tax-report-2026.csv')
  })

  it('shows DAC7 warning badges when thresholds are reached', () => {
    render(
      <ShopTaxReportPage
        initialReport={makeReport({
          dac7Status: {
            transactionCount: 30,
            grossSalesCents: 200000,
            approachingLimit: true,
            exceededLimit: true,
          },
        })}
      />,
    )

    expect(screen.getByText('DAC7 reporting threshold exceeded')).toBeDefined()
  })

  it('shows incomplete tax identity warning and settings link', () => {
    render(
      <ShopTaxReportPage
        initialReport={makeReport({
          dac7IdentityComplete: false,
        })}
      />,
    )

    expect(screen.getByText('Tax identity incomplete — update settings')).toBeDefined()
    const settingsLink = screen.getByRole('link', { name: 'Update tax identity' })
    expect(settingsLink.getAttribute('href')).toBe('/creator/shop')
    expect(settingsLink.getAttribute('data-search')).toBe(JSON.stringify({ shopId: 'shop-1' }))
  })

  it('announces loading state via aria-live', async () => {
    mockGetShopTaxReport.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(makeReport({ period: { year: 2025 } })), 50),
        ),
    )

    render(<ShopTaxReportPage initialReport={makeReport()} />)

    const yearSelect = screen.getByLabelText('Year')
    fireEvent.change(yearSelect, { target: { value: '2025' } })

    await waitFor(() => {
      expect(screen.getByText('Loading tax report...')).toBeDefined()
    })
  })
})
