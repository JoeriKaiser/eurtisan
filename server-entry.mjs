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

import { createServer } from 'node:http'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIRNAME = fileURLToPath(new URL('.', import.meta.url))
const CLIENT_DIR = join(DIRNAME, '../client')
// server.js is in the same directory as server-entry.mjs
const SERVER_DIR = DIRNAME
const PORT = parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

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

// Try to serve a static file from the client build directory
function serveStatic(urlPath) {
  const cleanPath = urlPath.split('?')[0]
  const fsPath = join(CLIENT_DIR, cleanPath)

  // Security: prevent directory traversal
  if (!fsPath.startsWith(CLIENT_DIR)) {
    return { body: null, mime: 'text/plain', status: 403 }
  }

  if (!existsSync(fsPath)) {
    return { body: null, mime: 'text/plain', status: 404 }
  }

  const stat = statSync(fsPath)
  if (!stat.isFile()) {
    return { body: null, mime: 'text/plain', status: 404 }
  }

  const ext = extname(fsPath).toLowerCase()
  const mime = MIME_TYPES[ext] ?? 'application/octet-stream'

  try {
    const body = readFileSync(fsPath)
    return { body, mime, status: 200 }
  } catch {
    return { body: null, mime: 'text/plain', status: 500 }
  }
}

// Create the HTTP server
const server = createServer(async (req, res) => {
  try {
    const url = req.url ?? '/'

    // Try static file serving first (before the TanStack handler)
    if (req.method === 'GET' || req.method === 'HEAD') {
      const staticResult = serveStatic(url)
      if (staticResult.status === 200 && staticResult.body) {
        const headers = {
          'Content-Type': staticResult.mime,
          'Content-Length': String(staticResult.body.length),
          'Cache-Control': url.startsWith('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=86400',
        }
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
    const scheme = 'http'
    const host = req.headers.host ?? 'localhost'
    const requestUrl = new URL(url, `${scheme}://${host}`)

    // Collect request body for POST/PUT etc.
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
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
      body: req.method !== 'GET' && req.method !== 'HEAD'
        ? body
        : undefined,
    })

    // Delegate to TanStack Start
    const response = await tanstackHandler(request)

    // Send the response back via Node.js
    const responseBody = await response.text()
    const responseHeaders = {}
    response.headers.forEach((value, key) => {
      // Skip transfer-encoding as Node.js handles chunked encoding itself
      if (key.toLowerCase() !== 'transfer-encoding') {
        responseHeaders[key] = value
      }
    })

    res.writeHead(response.status, response.statusText, responseHeaders)
    res.end(responseBody)
  } catch (error) {
    console.error('Unhandled error in HTTP server:', error)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Internal Server Error')
    }
  }
})

// Start listening
server.listen(PORT, HOST, () => {
  console.log(`Eurtisan server listening on http://${HOST}:${PORT}`)
  console.log(`Serving static files from: ${CLIENT_DIR}`)
  console.log(`TanStack Start handler imported from: ${SERVER_DIR}`)
})

// Graceful shutdown
function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`)
  server.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))