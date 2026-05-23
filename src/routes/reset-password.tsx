import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { ResetPassword } from '#/route-components/reset-password'
import { guardGuest } from '#/lib/route-guards'

const resetPasswordSearchSchema = z.object({
  token: z.string().optional().catch(''),
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/reset-password')({
  validateSearch: resetPasswordSearchSchema,
  beforeLoad: async () => guardGuest(),
  component: ResetPassword,
})
