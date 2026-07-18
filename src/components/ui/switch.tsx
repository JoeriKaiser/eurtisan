import type { ButtonHTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  ref?: React.Ref<HTMLButtonElement>
}

export function Switch({
  className,
  checked,
  onCheckedChange,
  ref,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <button
      ref={ref}
      type='button'
      role='switch'
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'relative block h-6 w-11 rounded-full border transition-colors duration-fast ease-out',
          checked
            ? 'border-transparent bg-accent-primary'
            : 'border-border-default bg-surface-inset',
        )}
        aria-hidden='true'
      >
        <span
          className={cn(
            'pointer-events-none absolute left-[2px] top-[2px] size-[18px] rounded-full bg-surface-default shadow-sm transition-transform duration-fast ease-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  )
}
