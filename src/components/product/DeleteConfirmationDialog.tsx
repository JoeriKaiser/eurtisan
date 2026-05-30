import { useEffect, useRef } from 'react'
import { Button } from '#/components/ui/button'

interface DeleteConfirmationDialogProps {
  open: boolean
  title: string
  description: string
  cancelLabel: string
  confirmLabel: string
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirmationDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  deleting,
  onCancel,
  onConfirm,
}: DeleteConfirmationDialogProps) {
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
      aria-labelledby='delete-dialog-title'
      aria-describedby='delete-dialog-description'
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <h3 id='delete-dialog-title' className='mb-2 text-lg font-semibold text-text-primary'>
        {title}
      </h3>
      <p id='delete-dialog-description' className='mb-6 text-sm text-text-secondary'>
        {description}
      </p>
      <div className='flex justify-end gap-3'>
        <Button variant='secondary' onClick={onCancel} disabled={deleting}>
          {cancelLabel}
        </Button>
        <Button variant='danger' onClick={onConfirm} isLoading={deleting} disabled={deleting}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
