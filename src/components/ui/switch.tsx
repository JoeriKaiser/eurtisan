import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type='button'
        role='switch'
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-fast ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
          checked ? 'bg-accent-primary' : 'border border-border-default bg-surface-inset',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-surface-default shadow-sm transition-transform duration-fast ease-out',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    )
  },
)

Switch.displayName = 'Switch'
