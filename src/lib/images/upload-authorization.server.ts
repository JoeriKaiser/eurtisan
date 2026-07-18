import { and, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { shop } from '#/db/schema'
import { requireRoleForUser } from '../authz'
import { requirePrivileged2FA, type SafeUser } from '../server-auth'

export async function authorizeImageUploadInternal(
  actor: SafeUser,
  onboardingDraftId?: string,
): Promise<void> {
  if (actor.role !== 'customer') {
    requireRoleForUser('creator', actor)
    requirePrivileged2FA(actor)
    return
  }

  if (!onboardingDraftId) throw new Error('ONBOARDING_DRAFT_REQUIRED')
  const draft = await db.query.shop.findFirst({
    where: and(
      eq(shop.id, onboardingDraftId),
      eq(shop.ownerId, actor.id),
      inArray(shop.status, ['draft', 'changes_requested']),
    ),
    columns: { id: true },
  })
  if (!draft) throw new Error('ONBOARDING_DRAFT_NOT_FOUND')
}
