import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

const invoiceBillingAddressSchema = z.object({
  name: z.string(),
  street: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string(),
  vatId: z.string().optional().nullable(),
  email: z.string().optional(),
  isVatRegistered: z.boolean().optional(),
})

const invoiceLineItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  totalCents: z.number().int(),
  vatRateBasisPoints: z.number().int(),
  vatAmountCents: z.number().int(),
})

const invoiceShippingSchema = z.object({
  costCents: z.number().int(),
  vatRateBasisPoints: z.number().int(),
  vatAmountCents: z.number().int(),
  method: z.string(),
})

export const invoiceBillingDetailsSchema = z.object({
  from: invoiceBillingAddressSchema,
  to: invoiceBillingAddressSchema,
  items: z.array(invoiceLineItemSchema),
  shipping: invoiceShippingSchema.optional(),
  reverseCharge: z.boolean().optional(),
})

export type InvoiceBillingDetails = z.infer<typeof invoiceBillingDetailsSchema>

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
