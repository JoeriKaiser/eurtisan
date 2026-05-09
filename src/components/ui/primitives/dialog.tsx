import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import * as React from 'react'
import { cn } from '#/lib/cn'

export const Dialog = BaseDialog.Root
export const DialogTrigger = BaseDialog.Trigger
export const DialogPortal = BaseDialog.Portal
export const DialogClose = BaseDialog.Close

export const DialogBackdrop = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <BaseDialog.Backdrop
    ref={ref}
    className={cn(
      'fixed inset-0 z-modal-backdrop bg-bg-overlay backdrop-blur-sm',
      'transition-opacity duration-fast ease-out',
      'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
      className,
    )}
    {...props}
  />
))
DialogBackdrop.displayName = 'DialogBackdrop'

export const DialogPopup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <BaseDialog.Popup
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        'z-modal w-full max-w-lg rounded-xl border border-border-default bg-surface-default p-6 shadow-xl',
        'transition-all duration-fast ease-out',
        'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
        'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
        className,
      )}
      {...props}
    />
  ),
)
DialogPopup.displayName = 'DialogPopup'

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <BaseDialog.Title
    ref={ref}
    className={cn('text-lg font-semibold text-text-primary', className)}
    {...props}
  />
))
DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <BaseDialog.Description
    ref={ref}
    className={cn('mt-2 text-sm text-text-secondary', className)}
    {...props}
  />
))
DialogDescription.displayName = 'DialogDescription'
