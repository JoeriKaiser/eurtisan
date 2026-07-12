/**
 * Mollie classic Payments API webhook — POST /api/webhooks/mollie
 *
 * Mollie posts an application/x-www-form-urlencoded body containing the
 * payment id. The server retrieves authoritative payment state from Mollie;
 * client redirects and callback body data never determine order state.
 */
import { createFileRoute } from '@tanstack/react-router'
import { processMollieWebhook } from '#/lib/payments/mollie-webhook.server'

export { processMollieWebhook }

export const Route = createFileRoute('/api/webhooks/mollie')({
  server: {
    handlers: {
      POST: async ({ request }) => processMollieWebhook(request),
    },
  },
})
