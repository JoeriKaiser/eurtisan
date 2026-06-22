/**
 * Structured JSON logger for server-side code.
 *
 * Emits single-line JSON objects suitable for log aggregators
 * (e.g. Loki, ELK, Datadog, CloudWatch).
 */

import { AsyncLocalStorage } from 'node:async_hooks'

import { alertLogTotal } from './metrics.server'

export const requestIdStore = new AsyncLocalStorage<string>()

export interface LogMeta extends Record<string, unknown> {
  error?: unknown
}

const SENSITIVE_KEYS = new Set([
  // Auth / secrets
  'password',
  'token',
  'authorization',
  'apiKey',
  'api_key',
  'secret',
  'refreshToken',
  'idToken',
  'accessToken',
  // PII
  'email',
  'name',
  'address',
  'street',
  'postalCode',
  'city',
  'country',
  'phone',
  'vatId',
  'taxId',
  'billingDetails',
  'shippingAddress',
  'billingAddress',
])

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key)
}

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(redactValue)
  }
  if (typeof value === 'object') {
    return redactObject(value as Record<string, unknown>)
  }
  return value
}

function redactObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = redactValue(value)
    }
  }
  return result as T
}

/**
 * Returns a deep copy of meta with sensitive keys redacted.
 * The original meta object is never mutated.
 */
export function redactMeta<T extends Record<string, unknown>>(meta: T): T {
  return redactObject(meta)
}

function writeLog(level: string, message: string, meta?: LogMeta): void {
  const payload: Record<string, unknown> = {
    level,
    service: 'eurtisan',
    message,
    timestamp: new Date().toISOString(),
  }

  if (meta) {
    const safeMeta = redactMeta(meta)
    for (const [key, value] of Object.entries(safeMeta)) {
      if (key === 'error' && value instanceof Error) {
        payload.error = value.message
        payload.stack = value.stack
      } else {
        payload[key] = value
      }
    }
  }

  if (payload.alert === true) {
    alertLogTotal.inc({ level })
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
