import type { SelectHTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
  ref?: React.Ref<HTMLSelectElement>
}

export function Select({ className, error, children, ref, ...props }: SelectProps) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full cursor-pointer rounded-lg border bg-surface-default px-3 text-sm text-text-primary',
        'transition-colors duration-fast ease-out',
        'focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error
          ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
          : 'border-border-default hover:border-border-strong',
        className,
      )}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${props.id}-error` : undefined}
      {...props}
    >
      {children}
    </select>
  )
}
