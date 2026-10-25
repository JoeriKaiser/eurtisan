import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { SignIn } from '#/route-components/signin'
import { guardGuest } from '#/lib/route-guards'
import { createUtilityMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'

const signinSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/signin')({
  validateSearch: signinSearchSchema,
  beforeLoad: async () => guardGuest(),
  head: () =>
    createUtilityMeta({
      title: `${m.sign_in_title()} | Eurtisan`,
      description: m.sign_in_description(),
    }),
  component: SignIn,
})
