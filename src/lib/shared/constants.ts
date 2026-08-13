/**
 * Shared production constants for order, dispute, and payout logic.
 *
 * Keep environment-agnostic business rules here so they have a single
 * source of truth and are easy to reference in tests.
 */

/** Dispute window in days after an order is marked delivered. */
export const DISPUTE_WINDOW_DAYS = 30

/** Token refresh safety margin in minutes before Mollie Connect access token expiry. */
export const MOLLIE_TOKEN_REFRESH_MARGIN_MINUTES = 5
