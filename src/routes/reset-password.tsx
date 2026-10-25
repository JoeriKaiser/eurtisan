import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { ResetPassword } from '#/route-components/reset-password'
import { guardGuest } from '#/lib/route-guards'
import { createUtilityMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'

const resetPasswordSearchSchema = z.object({
  token: z.string().optional().catch(''),
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/reset-password')({
  validateSearch: resetPasswordSearchSchema,
  beforeLoad: async () => guardGuest(),
  head: () =>
    createUtilityMeta({
      title: `${m.reset_password_title()} | Eurtisan`,
      description: m.reset_password_description(),
    }),
  component: ResetPassword,
})
