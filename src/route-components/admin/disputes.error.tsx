import { AlertTriangle } from 'lucide-react'

export function AdminDisputesError({ error }: { error: Error }) {
  return (
    <div className='text-center py-12'>
      <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
      <h1 className='display-title mb-4 text-2xl font-semibold text-text-primary'>
        Failed to load disputes
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
    </div>
  )
}
