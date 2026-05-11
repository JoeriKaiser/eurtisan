import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './auth-middleware'

export type {
  MarkReadResult,
  NotificationItem,
  NotificationsResult,
  NotificationType,
  UnreadCountResult,
} from './notifications.server'

export const getNotifications = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      page: z.number().int().min(1).optional().default(1),
      pageSize: z.number().int().min(1).max(100).optional().default(20),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getNotificationsQuery } = await import('./notifications.server')
    return getNotificationsQuery(context.user.id, data.page, data.pageSize)
  })

export const getUnreadNotificationCount = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { getUnreadNotificationCountQuery } = await import('./notifications.server')
    return getUnreadNotificationCountQuery(context.user.id)
  })

export const markNotificationRead = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ notificationId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { markNotificationReadQuery } = await import('./notifications.server')
    return markNotificationReadQuery(data.notificationId, context.user.id)
  })

export const markAllNotificationsRead = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { markAllNotificationsReadQuery } = await import('./notifications.server')
    return markAllNotificationsReadQuery(context.user.id)
  })
