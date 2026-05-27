/**
 * Structured JSON logger for server-side code.
 * Emits to stdout/stderr; captured by Docker → Alloy → Loki.
 * NEVER import this into client code.
 */

function log(
  level: 'info' | 'warn' | 'error' | 'fatal',
  msg: string,
  meta?: Record<string, unknown>,
) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    service: 'eurtisan-app',
    env: process.env.VITE_APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
    version: process.env.VITE_APP_VERSION ?? 'unknown',
    ...meta,
  }
  const stream = level === 'error' || level === 'fatal' ? process.stderr : process.stdout
  stream.write(`${JSON.stringify(entry)}\n`)
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  fatal: (msg: string, meta?: Record<string, unknown>) => log('fatal', msg, meta),
}
