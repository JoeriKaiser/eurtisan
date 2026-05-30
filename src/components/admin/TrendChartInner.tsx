import { use } from 'react'
import { m } from '#/paraglide/messages'

const rechartsPromise = import('recharts')

export interface TrendDataPoint {
  date: string
  value: number
}

interface TrendChartProps {
  data: TrendDataPoint[]
  color: string
  fillColor: string
  valueFormatter?: (value: number) => string
  ariaLabel: string
}

function CustomTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  valueFormatter?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  return (
    <div className='rounded-lg border border-border-default bg-surface-default px-3 py-2 text-xs shadow-md'>
      <p className='font-medium text-text-primary'>
        {label
          ? new Date(label).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : ''}
      </p>
      <p className='mt-0.5 text-text-secondary'>{valueFormatter ? valueFormatter(value) : value}</p>
    </div>
  )
}

export default function TrendChartInner({
  data,
  color,
  fillColor,
  valueFormatter,
  ariaLabel,
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className='flex h-64 items-center justify-center rounded-xl border border-border-default bg-surface-default text-sm text-text-muted'>
        {m.admin_chart_no_data()}
      </div>
    )
  }

  const hasData = data.some((d) => d.value > 0)

  if (!hasData) {
    return (
      <div className='flex h-64 items-center justify-center rounded-xl border border-border-default bg-surface-default text-sm text-text-muted'>
        {m.admin_chart_no_data()}
      </div>
    )
  }

  const { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } =
    use(rechartsPromise)

  return (
    <figure aria-label={ariaLabel}>
      <ResponsiveContainer width='100%' height={256}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id={`fill-${color.replace('#', '')}`} x1='0' y1='0' x2='0' y2='1'>
              <stop offset='5%' stopColor={fillColor} stopOpacity={0.3} />
              <stop offset='95%' stopColor={fillColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray='3 3' stroke='var(--ds-border-subtle)' vertical={false} />
          <XAxis
            dataKey='date'
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(value: string) =>
              new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            }
            stroke='var(--ds-text-muted)'
            fontSize={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={48}
            stroke='var(--ds-text-muted)'
            fontSize={12}
            tickFormatter={(value: number) => {
              if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
              return String(value)
            }}
          />
          <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
          <Area
            type='monotone'
            dataKey='value'
            stroke={color}
            fill={`url(#fill-${color.replace('#', '')})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  )
}
