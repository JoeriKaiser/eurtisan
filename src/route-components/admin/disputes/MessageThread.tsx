import { MessageCircle } from 'lucide-react'

export function MessageThread({
  messages,
}: {
  messages: Array<{ id: string; senderName: string; message: string; createdAt: Date | string }>
}) {
  if (messages.length === 0) {
    return (
      <div className='rounded-xl border border-border-default bg-surface-default p-6 text-center'>
        <MessageCircle size={32} className='mx-auto mb-3 text-text-muted' aria-hidden='true' />
        <p className='text-sm text-text-secondary'>No messages yet.</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className='rounded-xl border border-border-default bg-surface-default p-4'
        >
          <div className='mb-2 flex items-center justify-between'>
            <span className='text-sm font-medium text-text-primary'>{msg.senderName}</span>
            <span className='text-xs text-text-muted'>
              {new Date(msg.createdAt).toLocaleString()}
            </span>
          </div>
          <p className='whitespace-pre-wrap text-sm text-text-secondary'>{msg.message}</p>
        </div>
      ))}
    </div>
  )
}
