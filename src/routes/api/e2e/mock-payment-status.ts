/**
 * E2E-only helper to pre-configure the mock Mollie payment status.
 *
 * This endpoint is disabled outside the E2E environment. It lets deterministic
 * webhook specs assert both success and failure paths without relying on
 * external Mollie API calls.
 */
import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { setMockPaymentAmount, setMockPaymentStatus } from '#/integrations/mollie'

const bodySchema = z.object({
  paymentId: z.string().min(1),
  status: z.enum(['pending', 'paid', 'expired', 'failed', 'cancelled', 'chargeback']),
  amountCents: z.number().int().nonnegative().optional(),
})

export const Route = createFileRoute('/api/e2e/mock-payment-status')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env.E2E_TEST !== 'true') {
          return new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Bad Request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const parsed = bodySchema.safeParse(body)
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', issues: parsed.error.issues }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        setMockPaymentStatus(parsed.data.paymentId, parsed.data.status)
        if (parsed.data.amountCents !== undefined) {
          setMockPaymentAmount(parsed.data.paymentId, parsed.data.amountCents)
        }

        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
