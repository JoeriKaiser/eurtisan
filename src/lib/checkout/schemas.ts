import z from 'zod'
import { isoCountryCodeSchema, isPostalCodeValid } from '../address-validation'
import { validateVatId } from '../vat'

export const pickupPointSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  street: z.string().min(1),
  postalCode: z.string().min(3).max(20),
  city: z.string().min(1),
  country: isoCountryCodeSchema,
})

export const checkoutAddressSchema = z
  .object({
    name: z.string().trim().min(1, 'NAME_REQUIRED').max(255),
    street: z.string().trim().min(1, 'STREET_REQUIRED').max(255),
    addressLine2: z.string().trim().max(255),
    city: z.string().trim().min(1, 'CITY_REQUIRED').max(255),
    postalCode: z
      .string()
      .trim()
      .min(1, 'POSTAL_REQUIRED')
      .min(3, 'POSTAL_INVALID')
      .max(20, 'POSTAL_INVALID'),
    country: z.string().trim().min(1, 'COUNTRY_REQUIRED').pipe(isoCountryCodeSchema),
    contactEmail: z.string().trim().toLowerCase().email('EMAIL_INVALID').max(320),
    phone: z.string().trim().max(40),
    vatId: z.string().trim().optional().nullable(),
    pickupPoint: pickupPointSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!isPostalCodeValid(data.postalCode, data.country)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'POSTAL_INVALID', path: ['postalCode'] })
    }
    if (!data.vatId) return
    const cleaned = data.vatId.replace(/\s/g, '').toUpperCase()
    const prefix = cleaned.slice(0, 2)
    const prefixMatches =
      prefix === data.country || (data.country === 'GR' && (prefix === 'EL' || prefix === 'GR'))
    if (!prefixMatches) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'VAT_PREFIX_INVALID', path: ['vatId'] })
    }
    const { valid } = validateVatId(data.vatId)
    if (!valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'VAT_FORMAT_INVALID', path: ['vatId'] })
    }
  })

export const shippingSelectionSchema = z.object({
  shopId: z.string().min(1),
  rateId: z.string().optional(),
  method: z.enum(['standard', 'express', 'manual']),
  costCents: z.number().int().min(0),
})

export const checkoutInputSchema = z.object({
  cartId: z.string().uuid(),
  checkoutAttemptId: z.string().uuid(),
  shippingSelections: z.array(shippingSelectionSchema).min(1),
  shippingAddress: checkoutAddressSchema,
  billingAddress: checkoutAddressSchema,
})

export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>
