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
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-fast ease-out border',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-transparent bg-accent-primary' : 'border-border-default bg-surface-inset',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none absolute top-[1px] left-[1px] size-4 transform rounded-full bg-surface-default shadow-sm transition-transform duration-fast ease-out',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  )
}
