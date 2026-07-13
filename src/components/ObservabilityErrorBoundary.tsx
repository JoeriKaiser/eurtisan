import { Component, type ErrorInfo, type ReactNode } from 'react'
import { hasAnalyticsConsent } from '#/hooks/use-analytics-consent'
import { m } from '#/paraglide/messages'

interface ObservabilityErrorBoundaryProps {
  children: ReactNode
}

interface ObservabilityErrorBoundaryState {
  failed: boolean
}

export class ObservabilityErrorBoundary extends Component<
  ObservabilityErrorBoundaryProps,
  ObservabilityErrorBoundaryState
> {
  state: ObservabilityErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ObservabilityErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (!hasAnalyticsConsent()) return

    void import('#/integrations/faro').then(({ getFaro }) => {
      getFaro()?.api.pushError(error, {
        context: { componentStack: info.componentStack ?? '' },
      })
    })
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className='page-wrap px-4 py-16 text-center' role='alert'>
        <h1 className='display-title text-2xl font-semibold text-text-primary'>
          {m.error_unexpected()}
        </h1>
        <button
          type='button'
          className='mt-6 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-text-on-primary'
          onClick={() => window.location.reload()}
        >
          {m.admin_error_retry()}
        </button>
      </main>
    )
  }
}
