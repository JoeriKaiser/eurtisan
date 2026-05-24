import type { ButtonHTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  ref?: React.Ref<HTMLButtonElement>
}

export function Switch({ className, checked, onCheckedChange, ref, ...props }: SwitchProps) {
  return (
    <button
      ref={ref}
      type='button'
      role='switch'
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex size-5 shrink-0 items-center rounded-full transition-colors duration-fast ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
        checked ? 'bg-accent-primary' : 'border border-border-default bg-surface-inset',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-block size-4 transform rounded-full bg-surface-default shadow-sm transition-transform duration-fast ease-out',
          checked ? 'translate-x-5' : 'translate-x-1',
        )}
      />
    </button>
  )
}
