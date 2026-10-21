import { AlertTriangle } from 'lucide-react'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function AdminDisputesError({ error }: ErrorComponentProps) {
  return (
    <div className='text-center py-12'>
      <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
      <h1 className='mb-4 text-2xl font-semibold text-text-primary'>Failed to load disputes</h1>
      <p className='mb-6 text-text-secondary'>
        {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  )
}
