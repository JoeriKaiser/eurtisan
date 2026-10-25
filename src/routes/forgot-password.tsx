import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { ForgotPassword } from '#/route-components/forgot-password'
import { guardGuest } from '#/lib/route-guards'
import { createUtilityMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'

const forgotPasswordSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/forgot-password')({
  validateSearch: forgotPasswordSearchSchema,
  beforeLoad: async () => guardGuest(),
  head: () =>
    createUtilityMeta({
      title: `${m.forgot_password_title()} | Eurtisan`,
      description: m.forgot_password_description(),
    }),
  component: ForgotPassword,
})
