import type { ErrorComponentProps } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'

export function RootError({ error }: ErrorComponentProps) {
  const isDev = import.meta.env.DEV

  return (
    <div className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-semibold text-text-primary'>
        Something went wrong
      </h1>
      <p className='mb-6 text-text-secondary'>
        {isDev ? (error instanceof Error ? error.message : String(error)) : m.error_unexpected()}
      </p>
      {isDev && error instanceof Error && error.stack && (
        <pre className='mx-auto max-w-2xl overflow-auto rounded-xl bg-surface-inset p-4 text-left text-xs text-text-secondary'>
          {error.stack}
        </pre>
      )}
    </div>
  )
}
