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

export interface PurgeOldAuditLogsResult {
  deletedCount: number
}
