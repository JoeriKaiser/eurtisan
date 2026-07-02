import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { VerifyEmail } from '#/route-components/verify-email'
import { guardOptionalAuth } from '#/lib/route-guards'

const verifyEmailSearchSchema = z.object({
  email: z.string().optional().catch(''),
  token: z.string().optional().catch(''),
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/verify-email')({
  validateSearch: verifyEmailSearchSchema,
  beforeLoad: async () => guardOptionalAuth(),
  head: () => ({
    meta: [{ name: 'referrer', content: 'strict-origin-when-cross-origin' }],
  }),
  component: VerifyEmail,
})
