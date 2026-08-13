import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { VerifyEmail, VerifyEmailPending } from '#/route-components/verify-email'
import { guardOptionalAuth } from '#/lib/route-guards'
import { verifyEmailToken } from '#/lib/auth/verify-email'

const verifyEmailSearchSchema = z.object({
  email: z.string().optional().catch(''),
  token: z.string().optional().catch(''),
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/verify-email')({
  validateSearch: verifyEmailSearchSchema,
  beforeLoad: async () => guardOptionalAuth(),
  loaderDeps: ({ search: { token } }) => ({ token: token || undefined }),
  loader: async ({ deps }) => {
    if (!deps.token) return { status: 'idle' as const }
    try {
      const result = await verifyEmailToken({ data: { token: deps.token } })
      return { status: result.success ? ('success' as const) : ('error' as const) }
    } catch {
      return { status: 'error' as const }
    }
  },
  head: () => ({
    meta: [{ name: 'referrer', content: 'strict-origin-when-cross-origin' }],
  }),
  component: VerifyEmail,
  pendingComponent: VerifyEmailPending,
})
