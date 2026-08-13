const HYDRATION_READY_EVENT = 'eurtisan:hydrated'

/** Marks the document ready only after React has committed the hydrated tree. */
export function markDocumentHydrated(body: HTMLElement | null): (() => void) | undefined {
  if (!body) return

  const root = body.ownerDocument.documentElement
  let active = true

  // Run after the complete commit. This also avoids exposing a transient ready
  // marker during React Strict Mode's callback-ref setup/cleanup replay.
  queueMicrotask(() => {
    if (!active || !body.isConnected) return

    root.setAttribute('data-hydrated', 'true')
    const HydrationEvent = body.ownerDocument.defaultView?.CustomEvent
    if (HydrationEvent) root.dispatchEvent(new HydrationEvent(HYDRATION_READY_EVENT))
  })

  return () => {
    active = false
    root.removeAttribute('data-hydrated')
  }
}
