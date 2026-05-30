import { AlertTriangle, CheckCircle } from 'lucide-react'
import { m } from '#/paraglide/messages'

interface StatusAlertsProps {
  successMessage: string | null
  actionError: string | null
  onDismissError: () => void
}

export function StatusAlerts({ successMessage, actionError, onDismissError }: StatusAlertsProps) {
  return (
    <>
      {successMessage && (
        <div className='island-shell rounded-xl border border-success/30 bg-success-subtle p-4 text-sm text-success'>
          <CheckCircle size={16} className='mr-2 inline-block' aria-hidden='true' />
          {successMessage}
        </div>
      )}

      {actionError && (
        <div
          role='alert'
          className='island-shell rounded-xl border border-error/30 bg-error-subtle p-4 text-sm text-error'
        >
          <AlertTriangle size={16} className='mr-2 inline-block' aria-hidden='true' />
          {actionError}
          <button
            type='button'
            onClick={onDismissError}
            className='ml-2 underline hover:no-underline cursor-pointer'
          >
            {m.admin_shops_dismiss()}
          </button>
        </div>
      )}
    </>
  )
}
