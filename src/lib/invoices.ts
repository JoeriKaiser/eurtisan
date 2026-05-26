import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

/**
 * Fetches authenticated invoice details by invoice number.
 * Access is gated based on user roles and relationships.
 */
export const getInvoiceData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      invoiceNumber: z.string().min(1, 'Invoice number is required.'),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getInvoiceByIdQuery } = await import('./invoices.server')
    return getInvoiceByIdQuery(
      data.invoiceNumber,
      context.user.id,
      context.user.role as 'customer' | 'creator' | 'admin',
    )
  })
