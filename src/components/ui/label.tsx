import type { LabelHTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
  ref?: React.Ref<HTMLLabelElement>
}

export function Label({ className, children, required, htmlFor, ref, ...props }: LabelProps) {
  const classes = cn('block text-sm font-medium leading-snug text-text-primary', className)
  const content = (
    <>
      {children}
      {required && <span className='text-error'> *</span>}
    </>
  )

  if (!htmlFor) {
    return (
      <span ref={ref as React.Ref<HTMLSpanElement>} className={classes} {...props}>
        {content}
      </span>
    )
  }

  return (
    <label ref={ref} htmlFor={htmlFor} className={classes} {...props}>
      {content}
    </label>
  )
}
