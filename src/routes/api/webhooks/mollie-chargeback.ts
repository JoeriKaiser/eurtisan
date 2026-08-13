/**
 * Legacy Mollie callback alias — POST /api/webhooks/mollie-chargeback
 *
 * New Mollie payment and chargeback callbacks must use /api/webhooks/mollie.
 * This compatibility endpoint accepts the same classic form-encoded contract
 * and executes the same authoritative reconciliation path.
 */
import { createFileRoute } from '@tanstack/react-router'
import { processMollieWebhook } from '#/lib/payments/mollie-webhook.server'

export const processMollieChargebackWebhook = processMollieWebhook

export const Route = createFileRoute('/api/webhooks/mollie-chargeback')({
  server: {
    handlers: {
      POST: async ({ request }) => processMollieWebhook(request),
    },
  },
})
