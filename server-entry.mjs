/**
 * Eurtisan production Node.js server entry point.
 *
 * Provides:
 * - Static file serving from `dist/client/` (assets, favicon, images, etc.)
 * - TanStack Start SSR handler for all other requests
 * - Long-lived cache headers for hashed assets
 * - Graceful shutdown on SIGTERM/SIGINT
 *
 * The built TanStack Start handler (`dist/server/server.js`) only exports a
 * `fetch`-style handler — it does NOT create an HTTP server or serve static
 * files. This file wraps it with a full Node.js HTTP server.
 */

import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger, requestIdStore } from '../../src/lib/logger.server.ts'
import { runWithCspNonce } from '../../src/lib/csp-nonce.server.ts'
import { assertMockPayoutsNotProduction } from '../../src/lib/env.server.ts'

const DIRNAME = fileURLToPath(new URL('.', import.meta.url))
const CLIENT_DIR = join(DIRNAME, '../client')
// server.js is in the same directory as server-entry.mjs
const SERVER_DIR = DIRNAME
const PORT = parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

// Startup guard: mock payout modes are not allowed in production.
assertMockPayoutsNotProduction()
const MAX_BODY_SIZE = parseInt(process.env.MAX_BODY_SIZE ?? '10485760', 10)
const MAX_BODY_SIZE_WEBHOOKS = parseInt(process.env.MAX_BODY_SIZE_WEBHOOKS ?? '1048576', 10)

// MIME types for static files
const MIME_TYPES = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
}

// Import the TanStack Start SSR handler from dist/server/server.js
const serverModule = await import(join(SERVER_DIR, 'server.js'))
const tanstackHandler = serverModule.default.fetch

/**
 * Determine if a URL path is a public (cacheable) HTML route.
 */
function isPublicRoute(url) {
  const path = url.split('?')[0]
  if (path === '/') return true
  if (path.startsWith('/shops/')) return true
  if (path.startsWith('/category/')) return true
  if (path === '/search') return true
  if (path === '/about') return true
  if (path === '/terms') return true
  if (path === '/privacy') return true
  if (path === '/cookies') return true
  if (path === '/sitemap.xml') return true
  if (path === '/robots.txt') return true
  return false
}

/**
 * Determine if a URL path is a private (never-cache) HTML route.
 */
function isPrivateRoute(url) {
  const path = url.split('?')[0]
  if (path.startsWith('/account/') || path === '/account') return true
  if (path.startsWith('/checkout')) return true
  if (path.startsWith('/cart')) return true
  if (path.startsWith('/admin/') || path === '/admin') return true
  if (path.startsWith('/creator/') || path === '/creator') return true
  if (path.startsWith('/studio/') || path === '/studio') return true
  if (path.startsWith('/sell/') || path === '/sell') return true
  if (path.startsWith('/orders')) return true
  if (path.startsWith('/invoices/')) return true
  if (path.startsWith('/disputes/')) return true
  if (path.startsWith('/notifications')) return true
  if (path.startsWith('/api/auth/')) return true
  return false
}

// Try to serve a static file from the client build directory
function serveStatic(urlPath) {
  let cleanPath
  try {
    cleanPath = decodeURIComponent(urlPath.split('?')[0])
  } catch {
    return { body: null, mime: 'text/plain', status: 400, etag: null, lastModified: null }
  }
  const fsPath = join(CLIENT_DIR, cleanPath)

  // Security: prevent directory traversal
  if (!fsPath.startsWith(CLIENT_DIR)) {
    return { body: null, mime: 'text/plain', status: 403, etag: null, lastModified: null }
  }

  if (!existsSync(fsPath)) {
    return { body: null, mime: 'text/plain', status: 404, etag: null, lastModified: null }
  }

  const stat = statSync(fsPath)
  if (!stat.isFile()) {
    return { body: null, mime: 'text/plain', status: 404, etag: null, lastModified: null }
  }

  const ext = extname(fsPath).toLowerCase()
  const mime = MIME_TYPES[ext] ?? 'application/octet-stream'
  const etag = `"${stat.mtimeMs.toString(16)}"`
  const lastModified = stat.mtime.toUTCString()

  try {
    const body = readFileSync(fsPath)
    return { body, mime, status: 200, etag, lastModified }
  } catch (err) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      msg: 'Static file read failed',
      path: fsPath,
      error: err.message,
      service: 'eurtisan-app',
    }))
    return { body: null, mime: 'text/plain', status: 500, etag: null, lastModified: null }
  }
}

function getBodyLimit(url) {
  return url.startsWith('/api/webhooks/') ? MAX_BODY_SIZE_WEBHOOKS : MAX_BODY_SIZE
}

// Create the HTTP server
const server = createServer(async (req, res) => {
  const incomingRequestId = req.headers['x-request-id']
  const requestId = (Array.isArray(incomingRequestId) ? incomingRequestId[0] : incomingRequestId) || randomUUID()
  res.setHeader('X-Request-ID', requestId)

  await requestIdStore.run(requestId, async () => {
    try {
      const url = req.url ?? '/'

    // Try static file serving first (before the TanStack handler)
    if (req.method === 'GET' || req.method === 'HEAD') {
      const staticResult = serveStatic(url)
      if (staticResult.status === 200 && staticResult.body) {
        const ifNoneMatch = req.headers['if-none-match']
        const ifModifiedSince = req.headers['if-modified-since']

        const notModified =
          (ifNoneMatch && ifNoneMatch === staticResult.etag) ||
          (ifModifiedSince && ifModifiedSince === staticResult.lastModified)

        const cacheControl = url.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : url.startsWith('/uploads/')
            ? 'public, max-age=3600'
            : 'public, max-age=86400'

        const headers = {
          'Content-Type': staticResult.mime,
          'ETag': staticResult.etag,
          'Last-Modified': staticResult.lastModified,
          'Cache-Control': cacheControl,
        }

        if (notModified) {
          res.writeHead(304, headers)
          res.end()
          return
        }

        headers['Content-Length'] = String(staticResult.body.length)
        res.writeHead(200, headers)
        if (req.method === 'GET') {
          res.end(staticResult.body)
        } else {
          res.end()
        }
        return
      }
    }

    // Build a standard Request for the TanStack Start handler
    // Trust X-Forwarded-Proto when behind a reverse proxy (e.g. Caddy).
    // Falls back to 'http' for direct local connections.
    const forwardedProto = req.headers['x-forwarded-proto']
    const scheme = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || 'http'
    const host = req.headers.host ?? 'localhost'
    const requestUrl = new URL(url, `${scheme}://${host}`)

    const bodyLimit = getBodyLimit(url)

    // Content-Length shortcut: reject immediately if the declared size exceeds the limit
    const contentLength = req.headers['content-length']
    if (contentLength !== undefined) {
      const declaredLength = parseInt(contentLength, 10)
      if (!Number.isNaN(declaredLength) && declaredLength > bodyLimit) {
        logger.error(
          `Payload Too Large: Content-Length ${declaredLength} exceeds limit ${bodyLimit} for ${url}`,
        )
        res.writeHead(413, { 'Content-Type': 'text/plain' })
        res.end('Payload Too Large')
        return
      }
    }

    // Collect request body for POST/PUT etc. with size limit enforcement
    const chunks = []
    let accumulated = 0
    let oversized = false
    for await (const chunk of req) {
      accumulated += chunk.length
      if (accumulated > bodyLimit) {
        oversized = true
        break
      }
      chunks.push(chunk)
    }

    if (oversized) {
      logger.error(
        `Payload Too Large: accumulated body size exceeds limit ${bodyLimit} for ${url}`,
      )
      req.destroy()
      res.writeHead(413, { 'Content-Type': 'text/plain' })
      res.end('Payload Too Large')
      return
    }

    const body = Buffer.concat(chunks)

    const requestHeaders = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        requestHeaders[key] = Array.isArray(value) ? value.join(', ') : value
      }
    }

    const request = new Request(requestUrl, {
      method: req.method,
      headers: requestHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
    })

    // Delegate to TanStack Start (nonce scoped for CSP middleware)
    const cspNonce = randomBytes(16).toString('base64')
    const response = await runWithCspNonce(cspNonce, () => tanstackHandler(request))

    const responseHeaders = {}
    response.headers.forEach((value, key) => {
      // Skip transfer-encoding as Node.js handles chunked encoding itself
      if (key.toLowerCase() !== 'transfer-encoding') {
        responseHeaders[key] = value
      }
    })

    responseHeaders['Vary'] = 'Accept-Encoding, Accept-Language'

    // Add cache headers for public/private HTML routes
    if (req.method === 'GET' || req.method === 'HEAD') {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        if (isPublicRoute(url)) {
          responseHeaders['Cache-Control'] = 'public, s-maxage=60, max-age=0, stale-while-revalidate=300'
        } else if (isPrivateRoute(url)) {
          responseHeaders['Cache-Control'] = 'private, no-store'
        }
      }
    }

    res.writeHead(response.status, response.statusText, responseHeaders)

    if (response.body) {
      const reader = response.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
      } catch (streamErr) {
        logger.error('Error streaming response', streamErr)
      } finally {
        reader.releaseLock()
        res.end()
      }
    } else {
      res.end()
    }
    } catch (error) {
      logger.error('Unhandled error in HTTP server', error)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal Server Error')
      }
    }
  })
})

// Server timeouts — mitigate Slowloris / idle-connection DoS
server.timeout = 30000        // 30s total request timeout
server.keepAliveTimeout = 5000 // 5s keep-alive timeout
server.headersTimeout = 35000  // slightly longer than timeout

// Start listening
server.listen(PORT, HOST, () => {
  logger.info(`Eurtisan server listening on http://${HOST}:${PORT}`)
  logger.info(`Serving static files from: ${CLIENT_DIR}`)
  logger.info(`TanStack Start handler imported from: ${SERVER_DIR}`)
})

// Graceful shutdown
async function drainPoolAndExit() {
  try {
    const poolShutdown = globalThis.__eurtisan_shutdown_pool__
    if (typeof poolShutdown === 'function') {
      await poolShutdown()
      logger.info('Database pool drained')
    }
  } catch (err) {
    logger.error('Error draining database pool', err)
  }
  process.exit(0)
}

function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`)
  server.close(() => {
    logger.info('HTTP server closed')
    drainPoolAndExit()
  })
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
