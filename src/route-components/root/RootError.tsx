import { m } from '#/paraglide/messages'

export function RootError({ error }: { error: Error }) {
  const isDev = import.meta.env.DEV

  // Log full error server-side for debugging; client-side is handled by Faro.
  if (typeof window === 'undefined') {
    console.error('RootError:', error)
  }

  return (
    <div className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-semibold text-text-primary'>
        Something went wrong
      </h1>
      <p className='mb-6 text-text-secondary'>{isDev ? error.message : m.error_unexpected()}</p>
      {isDev && (
        <pre className='mx-auto max-w-2xl overflow-auto rounded-xl bg-surface-inset p-4 text-left text-xs text-text-secondary'>
          {error.stack}
        </pre>
      )}
    </div>
  )
}
