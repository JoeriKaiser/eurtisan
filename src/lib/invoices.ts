import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

const invoiceAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string(),
})

const invoiceBillingAddressSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  vatId: z.string().optional().nullable(),
  isVatRegistered: z.boolean().optional(),
  address: invoiceAddressSchema,
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
    const { getInvoiceByIdQuery, getInvoicePlatformOrderIdQuery } = await import(
      './invoices.server'
    )
    let userId = context.user?.id
    let role = context.user?.role
    if (!userId || !role) role = 'customer'
    if (role === 'customer') {
      const platformOrderId = await getInvoicePlatformOrderIdQuery(data.invoiceNumber)
      if (!platformOrderId) {
        throw new Response(JSON.stringify({ error: 'Not Found', message: 'Invoice not found.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const { canAccessOrder } = await import('./checkout/guest-access.server')
      if (!(await canAccessOrder(platformOrderId, context.user?.id))) {
        throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const { getOrderOwnerId } = await import('./orders.server')
      userId = (await getOrderOwnerId(platformOrderId)) ?? undefined
    }
    if (!userId) throw new Response(null, { status: 403 })
    const { decryptJsonb } = await import('./encryption.server')
    const invoice = await getInvoiceByIdQuery(data.invoiceNumber, userId, role)
    const decryptedDetails = decryptJsonb<InvoiceBillingDetails>(invoice.billingDetails)
    const parsed = invoiceBillingDetailsSchema.safeParse(decryptedDetails)
    if (!parsed.success) {
      throw new Response(
        JSON.stringify({ error: 'Internal Error', message: 'Invoice details are corrupted.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return { ...invoice, billingDetails: parsed.data }
  })
