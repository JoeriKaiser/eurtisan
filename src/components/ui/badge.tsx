import type { HTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'error' | 'success' | 'warning'
  ref?: React.Ref<HTMLSpanElement>
}

const variants = {
  default: 'bg-surface-inset text-text-secondary border border-border-default',
  primary: 'bg-accent-primary-subtle text-accent-primary border border-accent-primary/20',
  secondary: 'bg-accent-secondary-subtle text-accent-secondary border border-accent-secondary/20',
  outline: 'bg-transparent text-text-secondary border border-border-default',
  error: 'bg-error-subtle text-error border border-error/20',
  success: 'bg-success-subtle text-success border border-success/20',
  warning: 'bg-warning-subtle text-warning border border-warning/20',
}

export function Badge({ className, variant = 'default', ref, ...props }: BadgeProps) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
