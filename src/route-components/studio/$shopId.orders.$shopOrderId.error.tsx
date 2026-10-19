import type { ErrorComponentProps } from '@tanstack/react-router'

export function ShopOrderDetailError({ error }: ErrorComponentProps) {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-3xl text-center'>
        <h1 className='display-title mb-4 text-2xl font-semibold text-text-primary'>
          Failed to load order
        </h1>
        <p className='mb-6 text-text-secondary'>
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    </main>
  )
}
