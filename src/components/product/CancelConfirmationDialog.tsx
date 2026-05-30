import { useEffect, useRef } from 'react'
import { Button } from '#/components/ui/button'

interface CancelConfirmationDialogProps {
  open: boolean
  title: string
  description: string
  cancelLabel: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}

export function CancelConfirmationDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: CancelConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className='z-50 w-full max-w-sm rounded-xl bg-surface-default p-6 shadow-lg backdrop:bg-black/50 border-0'
      aria-labelledby='cancel-dialog-title'
      aria-describedby='cancel-dialog-description'
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <h3 id='cancel-dialog-title' className='mb-2 text-lg font-semibold text-text-primary'>
        {title}
      </h3>
      <p id='cancel-dialog-description' className='mb-6 text-sm text-text-secondary'>
        {description}
      </p>
      <div className='flex justify-end gap-3'>
        <Button variant='secondary' onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant='danger' onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
