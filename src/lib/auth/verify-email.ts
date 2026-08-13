import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

const verifyEmailTokenSchema = z.object({
  token: z.string().min(1).max(4096),
})

export const verifyEmailToken = createServerFn({ method: 'POST' })
  .inputValidator(verifyEmailTokenSchema)
  .handler(async ({ data }) => {
    const { auth } = await import('./config.server')
    const result = await auth.api.verifyEmail({ query: { token: data.token } })
    return { success: result?.status === true }
  })
