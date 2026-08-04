import { and, eq, isNull } from 'drizzle-orm'

import { db } from '#/db/index'
import { auditLog, notification, user, userNotificationPreference } from '#/db/schema'
import { OPTIONAL_IN_APP_NOTIFICATION_TYPES, type OptionalInAppNotificationType } from './delivery'
import type { NotificationType } from './operations.server'

export { OPTIONAL_IN_APP_NOTIFICATION_TYPES, type OptionalInAppNotificationType }

export interface InAppNotificationPreference {
  type: OptionalInAppNotificationType
  enabled: boolean
  labelKey: string
  descriptionKey: string
}

export function isOptionalInAppNotificationType(
  type: NotificationType,
): type is OptionalInAppNotificationType {
  return OPTIONAL_IN_APP_NOTIFICATION_TYPES.some((optionalType) => optionalType === type)
}

/**
 * Read the three user-configurable in-app preferences without materialising their
 * enabled-by-default state as rows. Required notification types are intentionally
 * absent: callers cannot mistake an explanation for a mutable preference.
 */
export async function getInAppNotificationPreferences(
  userId: string,
): Promise<InAppNotificationPreference[]> {
  const stored = await db
    .select({ type: userNotificationPreference.type, enabled: userNotificationPreference.enabled })
    .from(userNotificationPreference)
    .where(eq(userNotificationPreference.userId, userId))

  const enabledByType: Partial<Record<OptionalInAppNotificationType, boolean>> = {}
  for (const preference of stored) {
    if (isOptionalInAppNotificationType(preference.type)) {
      enabledByType[preference.type] = preference.enabled
    }
  }

  return OPTIONAL_IN_APP_NOTIFICATION_TYPES.map((type) => ({
    type,
    enabled: enabledByType[type] ?? true,
    labelKey: `account_in_app_preference_${type}`,
    descriptionKey: `account_in_app_preference_${type}_description`,
  }))
}

/** Required notification types are always enabled; optional types default to enabled. */
export async function isInAppNotificationEnabled(
  userId: string,
  type: NotificationType,
): Promise<boolean> {
  if (!isOptionalInAppNotificationType(type)) return true

  const [preference] = await db
    .select({ enabled: userNotificationPreference.enabled })
    .from(userNotificationPreference)
    .where(
      and(eq(userNotificationPreference.userId, userId), eq(userNotificationPreference.type, type)),
    )
    .limit(1)

  return preference?.enabled ?? true
}

/** Used by notification list and unread-count queries to apply preferences in SQL. */
export async function getDisabledInAppNotificationTypes(
  userId: string,
): Promise<OptionalInAppNotificationType[]> {
  const preferences = await db
    .select({ type: userNotificationPreference.type })
    .from(userNotificationPreference)
    .where(
      and(
        eq(userNotificationPreference.userId, userId),
        eq(userNotificationPreference.enabled, false),
      ),
    )

  return preferences.map((preference) => preference.type).filter(isOptionalInAppNotificationType)
}

/**
 * Upsert a mutable in-app preference and, on disable, mark its existing unread
 * notifications read in the same transaction. Rows are retained for history and
 * digest delivery; re-enabling never makes old notifications unread again.
 */
export async function updateInAppNotificationPreference(
  userId: string,
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  if (!isOptionalInAppNotificationType(type)) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: `Notification type cannot be disabled: ${type}`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  await db.transaction(async (tx) => {
    // This is the same lock used by createNotification, so no event can be
    // inserted unread after this transaction marks the type read.
    const [actor] = await tx
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .for('update')
      .limit(1)
    await tx
      .insert(userNotificationPreference)
      .values({ userId, type, enabled })
      .onConflictDoUpdate({
        target: [userNotificationPreference.userId, userNotificationPreference.type],
        set: { enabled, updatedAt: new Date() },
      })

    if (!enabled) {
      await tx
        .update(notification)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notification.userId, userId),
            eq(notification.type, type),
            isNull(notification.readAt),
          ),
        )
    }

    await tx.insert(auditLog).values({
      actorId: userId,
      actorName: actor?.name ?? 'Unknown',
      action: 'notification_preference_updated',
      resourceType: 'user_notification_preference',
      metadata: { type, enabled },
    })
  })
}
