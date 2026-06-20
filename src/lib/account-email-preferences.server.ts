import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

import { authMiddleware } from './auth-middleware'

const preferenceSchema = z.object({
  category: z.enum(['seller_updates', 'marketing', 'platform_announcements']),
  enabled: z.boolean(),
})

export const getMyEmailPreferences = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) {
      throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const { getEmailPreferences } = await import('./email-preferences.server')
    return getEmailPreferences(context.user.id)
  })

export const updateMyEmailPreference = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(preferenceSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const { updateEmailPreference } = await import('./email-preferences.server')
    await updateEmailPreference(context.user.id, data.category, data.enabled)
    return { success: true }
  })
