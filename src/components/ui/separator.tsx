import type { HTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export interface SeparatorProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical'
  ref?: React.Ref<HTMLHRElement>
}

export function Separator({
  className,
  orientation = 'horizontal',
  ref,
  ...props
}: SeparatorProps) {
  return (
    <hr
      ref={ref}
      aria-orientation={orientation}
      className={cn(
        'shrink-0 border-0 bg-border-default',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}
