import '@tanstack/react-start/server-only'

/**
 * Audit logging helper for owner and admin mutations.
 *
 * Writes structured records to the `audit_log` table so the platform can
 * review who changed what and when.
 */

import { db } from '#/db/index'
import { auditLog } from '#/db/schema'

// Transaction client type passed by db.transaction() callbacks.
type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface AuditActor {
  id: string
  name: string | null
}

export interface AuditLogInput {
  actor: AuditActor
  action: string
  resourceType: string
  resourceId?: string
  metadata?: Record<string, unknown>
}

export async function writeAuditLog(input: AuditLogInput, tx?: TransactionClient): Promise<void> {
  const client = tx ?? db
  await client.insert(auditLog).values({
    actorId: input.actor.id,
    actorName: input.actor.name ?? 'Unknown',
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: input.metadata ?? {},
  })
}

export function productAuditActor(user: { id: string; name?: string | null }): AuditActor {
  return { id: user.id, name: user.name ?? null }
}
