import { useCallback } from 'react'
import { trackSearchClick } from '#/lib/products'

/**
 * Report which search result a buyer opened.
 *
 * Fire-and-forget by design: click telemetry must never delay or block
 * navigation, and a failed report is not worth surfacing to the buyer.
 */
export function useSearchClickTracking() {
  return useCallback((query: string, productId: string, position: number) => {
    const trimmed = query.trim()
    if (!trimmed || !productId || position < 1) return

    void trackSearchClick({ data: { query: trimmed, productId, position } }).catch(() => {
      // Telemetry is best-effort.
    })
  }, [])
}
