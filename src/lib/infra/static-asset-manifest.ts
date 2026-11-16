import { existsSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'

const MIME_TYPES: Record<string, string> = {
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

export interface StaticAssetEntry {
  urlPath: string
  filePath: string
  size: number
  brPath: string | null
  brSize: number | null
  gzPath: string | null
  gzSize: number | null
  mime: string
  etag: string
  lastModified: string
  cacheControl: string
}

export interface StaticAssetResolution {
  status: 200 | 400 | 404
  filePath: string | null
  size: number
  mime: string
  etag: string | null
  lastModified: string | null
  cacheControl: string | null
  contentEncoding: 'br' | 'gzip' | null
}

/**
 * Determine Cache-Control header value for a static URL path.
 */
export function getStaticCacheControl(urlPath: string): string {
  if (urlPath.startsWith('/assets/')) {
    return 'public, max-age=31536000, immutable'
  }
  if (urlPath.startsWith('/uploads/')) {
    return 'public, max-age=3600'
  }
  return 'public, max-age=86400'
}

/**
 * Scan the built client directory once at startup and index static files by URL path.
 * Precompressed `.br` and `.gz` sidecar files are attached to their base asset entry
 * and excluded from direct URL lookup.
 */
export function buildStaticAssetMap(clientDir: string): Map<string, StaticAssetEntry> {
  const entries = new Map<string, StaticAssetEntry>()
  if (!existsSync(clientDir)) {
    return entries
  }

  const walk = (dir: string): void => {
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, dirent.name)
      if (dirent.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (!dirent.isFile()) {
        continue
      }
      if (dirent.name.endsWith('.br') || dirent.name.endsWith('.gz')) {
        continue
      }

      const relPath = relative(clientDir, fullPath).split(sep).join('/')
      const urlPath = `/${relPath}`
      const stat = statSync(fullPath)
      const ext = extname(fullPath).toLowerCase()
      const brCandidate = `${fullPath}.br`
      const gzCandidate = `${fullPath}.gz`
      const brStat = existsSync(brCandidate) ? statSync(brCandidate) : null
      const gzStat = existsSync(gzCandidate) ? statSync(gzCandidate) : null

      entries.set(urlPath, {
        urlPath,
        filePath: fullPath,
        size: stat.size,
        brPath: brStat?.isFile() ? brCandidate : null,
        brSize: brStat?.isFile() ? brStat.size : null,
        gzPath: gzStat?.isFile() ? gzCandidate : null,
        gzSize: gzStat?.isFile() ? gzStat.size : null,
        mime: MIME_TYPES[ext] ?? 'application/octet-stream',
        etag: `"${stat.mtimeMs.toString(16)}"`,
        lastModified: stat.mtime.toUTCString(),
        cacheControl: getStaticCacheControl(urlPath),
      })
    }
  }

  walk(clientDir)
  return entries
}

/**
 * Resolve a request URL path against the prebuilt static asset manifest without disk I/O.
 */
export function resolveStaticAsset(
  assetMap: ReadonlyMap<string, StaticAssetEntry>,
  rawUrl: string,
  acceptEncoding = '',
): StaticAssetResolution {
  let cleanPath: string
  try {
    cleanPath = decodeURIComponent(rawUrl.split('?')[0])
  } catch {
    return {
      status: 400,
      filePath: null,
      size: 0,
      mime: 'text/plain',
      etag: null,
      lastModified: null,
      cacheControl: null,
      contentEncoding: null,
    }
  }

  const entry = assetMap.get(cleanPath)
  if (!entry) {
    return {
      status: 404,
      filePath: null,
      size: 0,
      mime: 'text/plain',
      etag: null,
      lastModified: null,
      cacheControl: null,
      contentEncoding: null,
    }
  }

  const encoding = typeof acceptEncoding === 'string' ? acceptEncoding : ''
  if (encoding.includes('br') && entry.brPath && entry.brSize !== null) {
    return {
      status: 200,
      filePath: entry.brPath,
      size: entry.brSize,
      mime: entry.mime,
      etag: entry.etag,
      lastModified: entry.lastModified,
      cacheControl: entry.cacheControl,
      contentEncoding: 'br',
    }
  }
  if (
    (encoding.includes('gzip') || encoding.includes('deflate')) &&
    entry.gzPath &&
    entry.gzSize !== null
  ) {
    return {
      status: 200,
      filePath: entry.gzPath,
      size: entry.gzSize,
      mime: entry.mime,
      etag: entry.etag,
      lastModified: entry.lastModified,
      cacheControl: entry.cacheControl,
      contentEncoding: 'gzip',
    }
  }

  return {
    status: 200,
    filePath: entry.filePath,
    size: entry.size,
    mime: entry.mime,
    etag: entry.etag,
    lastModified: entry.lastModified,
    cacheControl: entry.cacheControl,
    contentEncoding: null,
  }
}
