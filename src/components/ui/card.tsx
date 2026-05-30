import type { HTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'inset'
  ref?: React.Ref<HTMLDivElement>
}

const variants = {
  default: 'bg-surface-default border border-border-default shadow-sm',
  elevated: 'bg-surface-elevated border border-border-default shadow-md',
  inset: 'bg-surface-inset border border-border-subtle',
}

export function Card({ className, variant = 'default', ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl transition-shadow duration-fast ease-out',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />
}

export function CardTitle({
  className,
  children,
  ref,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { ref?: React.Ref<HTMLHeadingElement> }) {
  return (
    <h3
      ref={ref}
      className={cn(
        'text-base font-semibold leading-none tracking-tight text-text-primary',
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardContent({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
}
