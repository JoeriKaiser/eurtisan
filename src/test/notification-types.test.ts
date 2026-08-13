import { describe, expect, it } from 'vitest'
import { notificationTypePgEnum } from '#/db/schema'
import { notificationTypeEnum } from '#/lib/notifications/operations.server'

/**
 * Keeps the database enum and the application enum in step.
 *
 * `notification.type` was `text` until this phase, with the closed set enforced
 * only in Zod while the read path asserted `row.type as NotificationType`. The
 * column is now an enum, so that assertion is finally true — but only while the
 * two lists agree.
 *
 * The failure modes are asymmetric and both bad:
 *
 * - A type in Zod but not in Postgres makes `createNotification` throw at
 *   insert, in whatever business flow happened to trigger it, long after the
 *   type looked fine in review.
 * - A type in Postgres but not in Zod is unreachable, and would render through
 *   the fallback rather than as itself.
 */
describe('notification types', () => {
  it('are the same set in the database and the application', () => {
    expect([...notificationTypePgEnum.enumValues].sort()).toEqual(
      [...notificationTypeEnum.options].sort(),
    )
  })

  it('are declared in the same order, so the two read as one list', () => {
    // Order carries no runtime meaning; matching order is what makes a diff
    // between the two files readable when a type is added.
    expect([...notificationTypePgEnum.enumValues]).toEqual([...notificationTypeEnum.options])
  })
})
