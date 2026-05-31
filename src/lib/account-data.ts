import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import z from 'zod'

import { authMiddleware } from './auth-middleware'
import { createUserRateLimitMiddleware } from './rate-limit'

const deleteAccountSchema = z.object({
  confirmEmail: z.string().email(),
})

export const exportMyData = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, createUserRateLimitMiddleware(3, 3_600_000, 'account-export')])
  .handler(async ({ context }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    const { exportUserData } = await import('./account-data.server')
    return exportUserData(context.user.id)
  })

export const deleteMyAccount = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, createUserRateLimitMiddleware(2, 86_400_000, 'account-delete')])
  .inputValidator(deleteAccountSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    if (context.user.email.toLowerCase() !== data.confirmEmail.toLowerCase()) {
      throw new Error('EMAIL_MISMATCH')
    }

    const { deleteUserAccount } = await import('./account-data.server')
    await deleteUserAccount(context.user.id)

    const request = getRequest()
    const { auth } = await import('./auth')
    await auth.api.signOut({ headers: request.headers })

    return { success: true as const }
  })
