import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

import { logger } from '#/lib/logger.server'
import { backupFailuresTotal, backupSuccessTotal } from '#/lib/metrics.server'

const reportSchema = z.object({
  status: z.enum(['success', 'failure']),
  file: z.string().optional(),
  error: z.string().optional(),
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

        const { status, file, error } = parseResult.data

        if (status === 'success') {
          backupSuccessTotal.inc()
          logger.info('Backup reported as successful', { file })
        } else {
          backupFailuresTotal.inc()
          logger.error('Backup reported as failed', error ? new Error(error) : undefined, {
            alert: true,
            file,
            error,
          })
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
