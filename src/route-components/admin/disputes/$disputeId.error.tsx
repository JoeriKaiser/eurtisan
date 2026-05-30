import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export function AdminDisputeDetailError({ error }: { error: Error }) {
  return (
    <div className='py-8'>
      <div className='mx-auto max-w-4xl text-center'>
        <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
        <h1 className='display-title mb-4 text-2xl font-semibold text-text-primary'>
          Failed to load dispute
        </h1>
        <p className='mb-6 text-text-secondary'>{error.message}</p>
        <Link
          to='/admin/disputes'
          search={{ page: 1 }}
          className='inline-flex items-center gap-2 text-sm text-accent-primary hover:underline'
        >
          <ArrowLeft size={16} aria-hidden='true' />
          Back to queue
        </Link>
      </div>
    </div>
  )
}
