import { AlertTriangle } from 'lucide-react'
import { m } from '#/paraglide/messages'

export function AdminAuditLogError({ error }: { error: Error }) {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_audit_log_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_audit_log_description()}</p>
      </div>
      <div
        role='alert'
        className='island-shell rounded-xl border border-error/30 bg-error-subtle p-4 text-sm text-error'
      >
        <AlertTriangle size={16} className='mr-2 inline-block' aria-hidden='true' />
        {error.message}
      </div>
    </div>
  )
}
