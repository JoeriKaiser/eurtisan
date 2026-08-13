import { lazy, Suspense } from 'react'
import type { TrendDataPoint } from './TrendChartInner'

export type { TrendDataPoint }

interface TrendChartProps {
  data: TrendDataPoint[]
  color: string
  fillColor: string
  valueFormatter?: (value: number) => string
  ariaLabel: string
}

const TrendChartInner = lazy(() => import('./TrendChartInner'))

export function TrendChart(props: TrendChartProps) {
  return (
    <Suspense
      fallback={
        <div className='flex h-64 items-center justify-center rounded-xl border border-border-default bg-surface-default text-sm text-text-muted'>
          Loading…
        </div>
      }
    >
      <TrendChartInner {...props} />
    </Suspense>
  )
}
