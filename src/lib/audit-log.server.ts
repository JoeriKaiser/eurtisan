import { lt, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { auditLog } from '#/db/schema'
import { logger } from './logger.server'
import type { SafeUser } from './server-auth'

/**
 * Emits an audit log entry for admin read-only access to sensitive resources.
 *
 * Silently no-ops when the actor is missing or is not an admin, so it can be
 * safely called after any admin-only read query.
 */
export async function emitAdminReadAudit(
  actor: SafeUser | null,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!actor || actor.role !== 'admin') return
  return emitAuditEvent(actor, action, resourceType, resourceId, metadata)
}

/**
 * Emits an audit log entry for an admin action.
 *
 * This is a fire-and-forget operation: failures are logged to stderr
 * but never thrown, so they cannot block user-facing mutations.
 */
export async function emitAuditEvent(
  actor: SafeUser | null,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!actor) return
  try {
    await db.insert(auditLog).values({
      actorId: actor.id,
      actorName: actor.name,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      metadata: metadata ?? {},
    })
  } catch (err) {
    // Audit logging must never break the primary business transaction.
    // Emit structured JSON error log as fallback so aggregators can flag failures.
    logger.error('Audit emission failed', err, {
      alert: true,
      event: 'audit_emission_failed',
      actorId: actor.id,
      actorName: actor.name,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      metadata: metadata ?? {},
    })
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Queries                                  */
/* -------------------------------------------------------------------------- */

export interface AuditLogListItem {
  id: string
  actorId: string | null
  actorName: string
  action: string
  resourceType: string
  resourceId: string | null
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface PaginatedAuditLog {
  entries: AuditLogListItem[]
  total: number
  page: number
  pageSize: number
}

/**
 * Returns paginated audit log entries with optional filtering.
 */
export async function listAuditLogQuery(params: {
  action?: string
  actorId?: string
  resourceType?: string
  resourceId?: string
  from?: Date
  to?: Date
  page: number
  pageSize: number
}): Promise<PaginatedAuditLog> {
  const { and, desc, eq, gte, lte, count } = await import('drizzle-orm')
  const offset = (params.page - 1) * params.pageSize

  const conditions = []

  if (params.action) {
    conditions.push(eq(auditLog.action, params.action))
  }
  if (params.actorId) {
    conditions.push(eq(auditLog.actorId, params.actorId))
  }
  if (params.resourceType) {
    conditions.push(eq(auditLog.resourceType, params.resourceType))
  }
  if (params.resourceId) {
    conditions.push(eq(auditLog.resourceId, params.resourceId))
  }
  if (params.from) {
    conditions.push(gte(auditLog.createdAt, params.from))
  }
  if (params.to) {
    conditions.push(lte(auditLog.createdAt, params.to))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        actorId: auditLog.actorId,
        actorName: auditLog.actorName,
        action: auditLog.action,
        resourceType: auditLog.resourceType,
        resourceId: auditLog.resourceId,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(params.pageSize)
      .offset(offset),
    db.select({ count: count() }).from(auditLog).where(where),
  ])

  return {
    entries: rows.map((r) => ({
      ...r,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    })),
    total: Number(totalResult[0]?.count ?? 0),
    page: params.page,
    pageSize: params.pageSize,
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Retention                                  */
/* -------------------------------------------------------------------------- */

export interface PurgeOldAuditLogsResult {
  deletedCount: number
}

/**
 * Deletes audit log entries older than the retention period.
 *
 * Default retention is 365 days. This is idempotent: repeated calls
 * simply find zero remaining old rows after the first successful run.
 */
export async function purgeOldAuditLogs(retentionDays = 365): Promise<PurgeOldAuditLogsResult> {
  const result = await db
    .delete(auditLog)
    .where(lt(auditLog.createdAt, sql`now() - ${retentionDays} * interval '1 day'`))
    .returning({ id: auditLog.id })

  return { deletedCount: result.length }
}
