export function AdminDisputeDetailPending() {
  return (
    <div className='py-8'>
      <div className='mx-auto max-w-4xl'>
        <div className='mb-6 size-4 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-8 size-8 animate-pulse rounded bg-[var(--sand)]' />
        <div className='space-y-6'>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className='island-shell h-40 animate-pulse rounded-xl bg-[var(--sand)]' />
          ))}
        </div>
      </div>
    </div>
  )
}
