import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import type * as React from 'react'
import { cn } from '#/lib/cn'

export const Dialog = BaseDialog.Root
export const DialogTrigger = BaseDialog.Trigger
export const DialogPortal = BaseDialog.Portal
export const DialogClose = BaseDialog.Close

export function DialogBackdrop({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
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
  )
}

export function DialogPopup({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
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
  )
}

export function DialogTitle({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { ref?: React.Ref<HTMLHeadingElement> }) {
  return (
    <BaseDialog.Title
      ref={ref}
      className={cn('text-lg font-semibold text-text-primary', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return (
    <BaseDialog.Description
      ref={ref}
      className={cn('mt-2 text-sm text-text-secondary', className)}
      {...props}
    />
  )
}
