import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TrendChartInner from './TrendChartInner'

vi.mock('#/paraglide/messages', () => ({
  m: {
    admin_chart_no_data: () => 'No data available for this period.',
  },
}))

describe('TrendChartInner', () => {
  it('renders empty state when data array is empty', () => {
    render(
      <TrendChartInner
        data={[]}
        color='var(--ds-accent-primary)'
        fillColor='var(--ds-accent-primary)'
        ariaLabel='Signups trend'
      />,
    )

    expect(screen.getByText('No data available for this period.')).toBeDefined()
  })

  it('renders empty state when all values are zero', () => {
    render(
      <TrendChartInner
        data={[
          { date: '2026-01-01', value: 0 },
          { date: '2026-01-02', value: 0 },
        ]}
        color='var(--ds-accent-primary)'
        fillColor='var(--ds-accent-primary)'
        ariaLabel='Signups trend'
      />,
    )

    expect(screen.getByText('No data available for this period.')).toBeDefined()
  })
})
