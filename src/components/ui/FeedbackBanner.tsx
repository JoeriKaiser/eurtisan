import { Check, X } from 'lucide-react'

interface FeedbackBannerProps {
  type: 'success' | 'error'
  message: string
}

export function FeedbackBanner({ type, message }: FeedbackBannerProps) {
  return (
    <div
      className={`mb-6 rounded-lg border p-4 text-sm ${
        type === 'success'
          ? 'border-success bg-success-subtle text-success'
          : 'border-error bg-error-subtle text-error'
      }`}
      role='alert'
    >
      <div className='flex items-center gap-2'>
        {type === 'success' ? (
          <Check size={18} aria-hidden='true' />
        ) : (
          <X size={18} aria-hidden='true' />
        )}
        <span>{message}</span>
      </div>
    </div>
  )
}
