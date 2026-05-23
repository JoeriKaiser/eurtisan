import { cn } from '#/lib/cn'

export interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  iconBgClass: string
  iconColorClass: string
  href?: string
  onClick?: () => void
}

export function StatCard({
  icon,
  label,
  value,
  iconBgClass,
  iconColorClass,
  href,
  onClick,
}: StatCardProps) {
  const content = (
    <>
      <div
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', iconBgClass)}
      >
        <span className={iconColorClass}>{icon}</span>
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-sm text-text-secondary'>{label}</p>
        <p className='text-2xl font-bold text-text-primary tabular-nums'>{value}</p>
      </div>
    </>
  )

  const className = cn(
    'island-shell flex items-start gap-4 rounded-xl p-5 transition-colors',
    (href || onClick) && 'cursor-pointer hover:bg-bg-inset/60',
  )

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    )
  }

  if (onClick) {
    return (
      <button type='button' onClick={onClick} className={cn(className, 'w-full text-left')}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}
