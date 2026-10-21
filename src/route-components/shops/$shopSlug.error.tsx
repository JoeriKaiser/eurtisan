import type { ErrorComponentProps } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'

export function ShopError({ error }: ErrorComponentProps) {
  return (
    <main className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-semibold text-text-primary'>
        {m.error_unexpected()}
      </h1>
      <p className='mb-6 text-text-secondary'>
        {error instanceof Error ? error.message : String(error)}
      </p>
    </main>
  )
}
