import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

export type {
  MarkReadResult,
  NotificationGroup,
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

    // Keep the database-backed implementation out of the browser bundle.
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

    // Keep the database-backed implementation out of the browser bundle.
    const { getUnreadNotificationCountQuery } = await import('./notifications.server')
    return getUnreadNotificationCountQuery(context.user.id)
  })

export const markNotificationsRead = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ notificationIds: z.array(z.string().uuid()).min(1).max(100) }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Keep the database-backed implementation out of the browser bundle.
    const { markNotificationsReadQuery } = await import('./notifications.server')
    return markNotificationsReadQuery(data.notificationIds, context.user.id)
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

    // Keep the database-backed implementation out of the browser bundle.
    const { markAllNotificationsReadQuery } = await import('./notifications.server')
    return markAllNotificationsReadQuery(context.user.id)
  })
