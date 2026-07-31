/**
 * What a product page should say about availability.
 *
 * Three states rather than a raw number, driven by the **seller's own**
 * `lowStockThreshold` — the column the low-stock job already uses. A number
 * hardcoded in the UI would call five units "nearly gone" for a maker who
 * restocks weekly and "plenty" for one who makes four a year.
 *
 * Deliberately not urgency theatre. No countdown, no "X people are viewing
 * this", no invented scarcity — those are the practices the Omnibus amendments
 * to the UCPD target, and this codebase has none. The only claim made here is
 * the stock count, which is true by construction.
 */
export type AvailabilityState =
  | { kind: 'out_of_stock' }
  /** At or below the seller's threshold; the exact count is worth showing. */
  | { kind: 'low_stock'; count: number }
  | { kind: 'in_stock' }

export function resolveAvailability(
  stockCount: number,
  lowStockThreshold: number,
): AvailabilityState {
  if (stockCount <= 0) return { kind: 'out_of_stock' }
  // `<=` rather than `<`: a threshold of 5 means five is already low, which is
  // how `lowStockThreshold` is read by the low-stock job.
  if (stockCount <= Math.max(0, lowStockThreshold)) return { kind: 'low_stock', count: stockCount }
  return { kind: 'in_stock' }
}
