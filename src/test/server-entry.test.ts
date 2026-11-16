import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildStaticAssetMap, resolveStaticAsset } from '#/lib/infra/static-asset-manifest'

const tempDirs: string[] = []

function createTempClientDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'eurtisan-static-manifest-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('Static asset startup manifest', () => {
  it('indexes client assets once and resolves raw, br, and gz variants without disk checks', () => {
    const clientDir = createTempClientDir()
    const assetsDir = join(clientDir, 'assets')
    mkdirSync(assetsDir, { recursive: true })

    const rawFile = join(assetsDir, 'app.js')
    const brFile = `${rawFile}.br`
    const gzFile = `${rawFile}.gz`
    const favicon = join(clientDir, 'favicon.svg')

    writeFileSync(rawFile, 'console.log("raw")')
    writeFileSync(brFile, 'br-bytes')
    writeFileSync(gzFile, 'gzip-bytes-123')
    writeFileSync(favicon, '<svg></svg>')

    const manifest = buildStaticAssetMap(clientDir)

    // Sidecar files are attached to base entry, never exposed as standalone routes
    expect(manifest.has('/assets/app.js')).toBe(true)
    expect(manifest.has('/assets/app.js.br')).toBe(false)
    expect(manifest.has('/assets/app.js.gz')).toBe(false)
    expect(resolveStaticAsset(manifest, '/assets/app.js.br', 'br').status).toBe(404)

    // Remove the directory on disk to prove resolveStaticAsset performs zero filesystem I/O
    rmSync(clientDir, { recursive: true, force: true })

    const brHit = resolveStaticAsset(manifest, '/assets/app.js?v=1', 'gzip, deflate, br')
    expect(brHit.status).toBe(200)
    expect(brHit.filePath).toBe(brFile)
    expect(brHit.size).toBe(8)
    expect(brHit.contentEncoding).toBe('br')
    expect(brHit.mime).toBe('application/javascript')
    expect(brHit.cacheControl).toBe('public, max-age=31536000, immutable')

    const gzHit = resolveStaticAsset(manifest, '/assets/app.js', 'gzip')
    expect(gzHit.status).toBe(200)
    expect(gzHit.filePath).toBe(gzFile)
    expect(gzHit.size).toBe(14)
    expect(gzHit.contentEncoding).toBe('gzip')

    const rawHit = resolveStaticAsset(manifest, '/assets/app.js', '')
    expect(rawHit.status).toBe(200)
    expect(rawHit.filePath).toBe(rawFile)
    expect(rawHit.contentEncoding).toBeNull()

    const iconHit = resolveStaticAsset(manifest, '/favicon.svg', 'br')
    expect(iconHit.status).toBe(200)
    expect(iconHit.mime).toBe('image/svg+xml')
    expect(iconHit.cacheControl).toBe('public, max-age=86400')
    expect(iconHit.contentEncoding).toBeNull()
  })

  it('returns 400 on malformed URI sequences and 404 on SSR routes', () => {
    const clientDir = createTempClientDir()
    const manifest = buildStaticAssetMap(clientDir)

    expect(resolveStaticAsset(manifest, '/%E0%A4%A').status).toBe(400)
    expect(resolveStaticAsset(manifest, '/search?q=ceramics').status).toBe(404)
  })
})
