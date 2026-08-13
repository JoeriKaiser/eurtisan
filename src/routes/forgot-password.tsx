import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { ForgotPassword } from '#/route-components/forgot-password'
import { guardGuest } from '#/lib/route-guards'

const forgotPasswordSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/forgot-password')({
  validateSearch: forgotPasswordSearchSchema,
  beforeLoad: async () => guardGuest(),
  component: ForgotPassword,
})
