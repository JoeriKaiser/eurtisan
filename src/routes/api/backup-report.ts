import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

import { logger } from '#/lib/logger.server'
import {
  backupFailuresTotal,
  backupLastSuccessTimestamp,
  backupSuccessTotal,
  postgresWalArchiveFailedCount,
  postgresWalArchivePendingFiles,
} from '#/lib/metrics.server'

const reportSchema = z.object({
  status: z.enum(['success', 'failure']),
  reportType: z.enum(['result', 'status']).default('result'),
  operation: z
    .enum(['logical', 'physical-full', 'physical-diff', 'wal-archive'])
    .default('logical'),
  file: z.string().max(512).optional(),
  error: z.string().max(512).optional(),
  lastSuccessEpoch: z
    .number()
    .int()
    .nonnegative()
    .refine((value) => value <= Math.floor(Date.now() / 1000) + 300)
    .optional(),
  walArchiveFailedCount: z.number().int().nonnegative().max(1_000_000_000).optional(),
  walPendingFiles: z.number().int().nonnegative().max(1_000_000).optional(),
})

function isAuthorized(request: Request): boolean {
  const expected = process.env.BACKUP_REPORT_TOKEN || process.env.METRICS_TOKEN
  if (!expected) {
    return false
  }

  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const url = new URL(request.url)
  const queryToken = url.searchParams.get('token') || ''

  return bearer === expected || queryToken === expected
}

export const Route = createFileRoute('/api/backup-report')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const parseResult = reportSchema.safeParse(body)
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: 'Invalid report payload' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const {
          status,
          reportType,
          operation,
          file,
          error,
          lastSuccessEpoch,
          walArchiveFailedCount,
          walPendingFiles,
        } = parseResult.data

        if (lastSuccessEpoch !== undefined) {
          backupLastSuccessTimestamp.set({ backup_type: operation }, lastSuccessEpoch)
        }
        if (operation === 'wal-archive') {
          if (walArchiveFailedCount !== undefined) {
            postgresWalArchiveFailedCount.set(walArchiveFailedCount)
          }
          if (walPendingFiles !== undefined) {
            postgresWalArchivePendingFiles.set(walPendingFiles)
          }
        }

        if (reportType === 'result') {
          if (status === 'success') {
            backupSuccessTotal.inc()
            logger.info('Backup reported as successful', { file, operation })
          } else {
            backupFailuresTotal.inc()
            logger.error('Backup reported as failed', error ? new Error(error) : undefined, {
              alert: true,
              file,
              error,
              operation,
            })
          }
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
