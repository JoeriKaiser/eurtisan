import z from 'zod'

/**
 * Seller declaration required by Consumer Rights Directive Article 6a.
 *
 * This is independent of DAC7 legal entity type and must never be inferred from
 * tax identity data.
 */
export const TRADER_STATUSES = ['trader', 'non_trader'] as const

export const traderStatusSchema = z.enum(TRADER_STATUSES)

export type TraderStatus = z.infer<typeof traderStatusSchema>
