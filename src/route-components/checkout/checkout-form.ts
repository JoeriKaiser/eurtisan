import {
  formOptions,
  useForm,
  type FormOptions,
  type ReactFormExtendedApi,
} from '@tanstack/react-form'
import z from 'zod'
import { checkoutAddressSchema } from '#/lib/checkout/schemas'

export const addressSchema = checkoutAddressSchema
/**
 * Billing fields are captured as a loose draft: they only need to satisfy the
 * full address rules when "same as shipping" is unchecked, which the form
 * schema below enforces with a conditional refinement.
 */
const billingDraftAddressSchema = z.object({
  name: z.string(),
  street: z.string(),
  addressLine2: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z.string(),
  contactEmail: z.string(),
  phone: z.string(),
  vatId: z.string().optional().nullable(),
  pickupPoint: z
    .object({
      id: z.string(),
      name: z.string(),
      street: z.string(),
      postalCode: z.string(),
      city: z.string(),
      country: z.string(),
    })
    .optional(),
})

export const checkoutFormSchema = z
  .object({
    shippingAddress: addressSchema,
    sameAsShipping: z.boolean(),
    billingAddress: billingDraftAddressSchema,
    shippingSelections: z.array(
      z.object({
        shopId: z.string().min(1),
        rateId: z.string().optional(),
        method: z.enum(['standard', 'express', 'manual']),
        costCents: z.number(),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    if (!data.sameAsShipping) {
      const result = addressSchema.safeParse(data.billingAddress)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            ...issue,
            path: ['billingAddress', ...issue.path],
          })
        }
      }
    }
  })

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>

type CheckoutFormValidateFn = typeof checkoutFormSchema

/**
 * The exact `FormApi` instantiation the checkout page creates: standard-schema
 * validation on change and submit, no async or dynamic validators, no submit
 * meta. Panels accept the shared page instance through this named type.
 */
export type CheckoutFormApi = ReactFormExtendedApi<
  CheckoutFormValues,
  undefined,
  CheckoutFormValidateFn,
  undefined,
  undefined,
  undefined,
  CheckoutFormValidateFn,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined
>

/**
 * Creates the checkout form instance. Wrapping {@link useForm} pins the
 * library's generic instantiation to {@link CheckoutFormApi}, so every call
 * site produces the exact instance type the panels accept — inline option
 * objects cannot drift into a different inference.
 */
export function useCheckoutForm(
  options: FormOptions<
    CheckoutFormValues,
    undefined,
    CheckoutFormValidateFn,
    undefined,
    undefined,
    undefined,
    CheckoutFormValidateFn,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined
  >,
): CheckoutFormApi {
  return useForm(formOptions(options))
}
