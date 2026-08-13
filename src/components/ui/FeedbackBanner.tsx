import { AlertTriangle, Check, Info, type LucideIcon } from 'lucide-react'
import { cn } from '#/lib/cn'

interface FeedbackBannerProps {
  type: 'success' | 'error' | 'info'
  message: string
  size?: 'sm' | 'md'
  icon?: LucideIcon
}

const defaultIcons: Record<FeedbackBannerProps['type'], LucideIcon> = {
  success: Check,
  error: AlertTriangle,
  info: Info,
}

const typeStyles: Record<FeedbackBannerProps['type'], string> = {
  success: 'border-success bg-success-subtle text-success',
  error: 'border-error bg-error-subtle text-error',
  info: 'border-border-default bg-surface-inset text-text-secondary',
}

export function FeedbackBanner({ type, message, size = 'md', icon }: FeedbackBannerProps) {
  const Icon = icon ?? defaultIcons[type]
  const isError = type === 'error'

  return (
    <div
      className={cn(
        'rounded-lg border',
        size === 'md' ? 'mb-6 p-4 text-sm' : 'p-3 text-xs',
        typeStyles[type],
      )}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <div className='flex items-start gap-2'>
        <Icon
          className={cn('shrink-0', size === 'md' ? 'mt-0.5 size-[18px]' : 'mt-0.5 size-4')}
          aria-hidden='true'
        />
        <span>{message}</span>
      </div>
    </div>
  )
}
