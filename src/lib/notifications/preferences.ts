import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

import { authMiddleware } from '../auth-middleware'
import { OPTIONAL_IN_APP_NOTIFICATION_TYPES } from './delivery'

export type {
  InAppNotificationPreference,
  OptionalInAppNotificationType,
} from './preferences.server'

const inAppNotificationPreferenceSchema = z.object({
  type: z.enum(OPTIONAL_IN_APP_NOTIFICATION_TYPES),
  enabled: z.boolean(),
})

export const getMyInAppNotificationPreferences = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) {
      throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // This module is imported by client settings UI; load the database helper
    // only inside the server-function boundary.
    const { getInAppNotificationPreferences } = await import('./preferences.server')
    return getInAppNotificationPreferences(context.user.id)
  })

export const updateMyInAppNotificationPreference = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(inAppNotificationPreferenceSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // This module is imported by client settings UI; load the database helper
    // only inside the server-function boundary.
    const { updateInAppNotificationPreference } = await import('./preferences.server')
    await updateInAppNotificationPreference(context.user.id, data.type, data.enabled)
    return { success: true }
  })
