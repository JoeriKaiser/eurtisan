import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '#/lib/cn'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium rounded-lg transition-all duration-fast ease-out focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'

    const variants = {
      primary:
        'bg-accent-primary text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active shadow-sm',
      secondary:
        'bg-surface-default text-text-primary border border-border-default hover:bg-bg-inset hover:border-border-strong shadow-sm',
      ghost: 'bg-transparent text-text-secondary hover:bg-bg-inset hover:text-text-primary',
      danger: 'bg-error text-on-primary hover:bg-error-hover active:opacity-90 shadow-sm',
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className='h-4 w-4 animate-spin'
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
  },
)

Button.displayName = 'Button'
