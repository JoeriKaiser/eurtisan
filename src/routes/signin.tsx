import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { SignIn } from '#/route-components/signin'
import { guardGuest } from '#/lib/route-guards'

const signinSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/signin')({
  validateSearch: signinSearchSchema,
  beforeLoad: async () => guardGuest(),
  component: SignIn,
})
