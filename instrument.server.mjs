// Global server instrumentation for Eurtisan.
// This file is imported via --import before the application server starts.
// It must not import application logic or database modules.

const env = process.env.VITE_APP_ENV ?? process.env.NODE_ENV ?? 'unknown'
const version = process.env.VITE_APP_VERSION ?? 'unknown'

function logStructured(level, message, extra = {}) {
  const log = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    env,
    version,
    service: 'eurtisan-app',
    ...extra,
  }
  const stream = level === 'error' || level === 'fatal' ? process.stderr : process.stdout
  stream.write(JSON.stringify(log) + '\n')
}

process.on('uncaughtException', (err) => {
  logStructured('fatal', 'Uncaught exception', {
    error: err.message,
    stack: err.stack,
    type: err.name,
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logStructured('error', 'Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  })
})

/* -------------------------------------------------------------------------- */
/*                        Production mock-mode guard                         */
/* -------------------------------------------------------------------------- */

if (env === 'production') {
  const forbiddenMocks = []
  if (process.env.MOCK_PAYMENTS_ENABLED === 'true') forbiddenMocks.push('MOCK_PAYMENTS_ENABLED')
  if (process.env.MOCK_PAYOUTS_ENABLED === 'true') forbiddenMocks.push('MOCK_PAYOUTS_ENABLED')

  if (forbiddenMocks.length > 0) {
    const message = `FATAL: Mock modes are not allowed in production: ${forbiddenMocks.join(', ')}`
    logStructured('fatal', message, { forbiddenMocks })
    throw new Error(message)
  }

  if (!process.env.METRICS_TOKEN || process.env.METRICS_TOKEN.trim().length === 0) {
    const message =
      'FATAL: METRICS_TOKEN is required in production to protect /api/metrics from public access'
    logStructured('fatal', message)
    throw new Error(message)
  }
}
