import type { ButtonHTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  ref?: React.Ref<HTMLButtonElement>
}

const baseStyles =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold rounded-lg transition-all duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 active:scale-[0.98] active:duration-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'

const variants = {
  primary:
    'bg-accent-primary text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active shadow-sm',
  secondary:
    'bg-surface-default text-text-primary border border-border-default hover:bg-bg-inset hover:border-border-strong shadow-sm',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-inset hover:text-text-primary',
  danger: 'bg-error text-text-on-primary hover:bg-error-hover active:bg-error-hover shadow-sm',
}

const sizes = {
  sm: 'h-11 px-3.5 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  children,
  type = 'button',
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && (
        <svg
          className='size-4 animate-spin'
          xmlns='http://www.w3.org/2000/svg'
          fill='none'
          viewBox='0 0 24 24'
          aria-hidden='true'
        >
          <circle
            className='opacity-25'
            cx='12'
            cy='12'
            r='10'
            stroke='currentColor'
            strokeWidth='4'
          />
          <path
            className='opacity-75'
            fill='currentColor'
            d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
          />
        </svg>
      )}
      {children}
    </button>
  )
}
