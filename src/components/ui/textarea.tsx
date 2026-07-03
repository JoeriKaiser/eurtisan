import type { TextareaHTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
  ref?: React.Ref<HTMLTextAreaElement>
}

export function Textarea({ className, error, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex w-full rounded-lg border bg-surface-default px-3 py-3 text-sm text-text-primary',
        'placeholder:text-text-placeholder',
        'transition-colors duration-fast ease-out',
        'focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'resize-y',
        error
          ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
          : 'border-border-default hover:border-border-strong',
        className,
      )}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${props.id}-error` : undefined}
      {...props}
    />
  )
}
