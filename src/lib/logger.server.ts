/**
 * Structured JSON logger for server-side code.
 *
 * Emits single-line JSON objects suitable for log aggregators
 * (e.g. Loki, ELK, Datadog, CloudWatch).
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export const requestIdStore = new AsyncLocalStorage<string>()

export interface LogMeta extends Record<string, unknown> {
  error?: unknown
}

function writeLog(level: string, message: string, meta?: LogMeta): void {
  const payload: Record<string, unknown> = {
    level,
    service: 'eurtisan',
    message,
    timestamp: new Date().toISOString(),
  }

  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (key === 'error' && value instanceof Error) {
        payload.error = value.message
        payload.stack = value.stack
      } else {
        payload[key] = value
      }
    }
  }

  const line = JSON.stringify(payload)

  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line)
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line)
  } else {
    // eslint-disable-next-line no-console
    console.log(line)
  }
}

export interface Logger {
  info(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  error(message: string, error?: unknown, meta?: LogMeta): void
}

export function createLogger(requestId?: string): Logger {
  const baseMeta: LogMeta = requestId ? { requestId } : {}
  if (!baseMeta.requestId) {
    const storeRequestId = requestIdStore.getStore()
    if (storeRequestId) {
      baseMeta.requestId = storeRequestId
    }
  }

  return {
    info(message: string, meta?: LogMeta): void {
      writeLog('info', message, { ...baseMeta, ...meta })
    },
    warn(message: string, meta?: LogMeta): void {
      writeLog('warn', message, { ...baseMeta, ...meta })
    },
    error(message: string, error?: unknown, meta?: LogMeta): void {
      const merged: LogMeta = { ...baseMeta, ...meta }
      if (error !== undefined) {
        merged.error = error
      }
      writeLog('error', message, merged)
    },
  }
}

export const logger: Logger = createLogger()
