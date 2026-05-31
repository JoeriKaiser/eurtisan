/**
 * PostgreSQL error helpers for Drizzle / node-pg.
 */

/** SQLSTATE unique_violation */
export const PG_UNIQUE_VIOLATION = '23505'

export function isPostgresUniqueViolation(err: unknown, constraint?: string): boolean {
  const pgErr = unwrapPgError(err)
  if (!pgErr || pgErr.code !== PG_UNIQUE_VIOLATION) return false
  if (!constraint) return true
  return pgErr.constraint === constraint
}

function unwrapPgError(err: unknown): { code?: string; constraint?: string } | null {
  if (!err || typeof err !== 'object') return null
  const direct = err as { code?: string; constraint?: string; cause?: unknown }
  if (direct.code === PG_UNIQUE_VIOLATION) return direct
  if (direct.cause) return unwrapPgError(direct.cause)
  return null
}
