import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const assetsDir = fileURLToPath(new URL('../dist/client/assets', import.meta.url))

if (!existsSync(assetsDir)) {
  console.log(`[precompress-assets] Assets directory not found at ${assetsDir}; skipping.`)
  process.exit(0)
}

const TARGET_EXTENSIONS: Record<string, true> = {
  '.js': true,
  '.css': true,
  '.svg': true,
}
function getFilesRecursively(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath))
    } else if (entry.isFile()) {
      if (TARGET_EXTENSIONS[extname(entry.name).toLowerCase()]) {
        files.push(fullPath)
      }
    }
  }
  return files
}

const files = getFilesRecursively(assetsDir)

if (files.length === 0) {
  console.log('[precompress-assets] No matching asset files found to precompress.')
  process.exit(0)
}

let totalRawBytes = 0
let totalBrotliBytes = 0
let totalGzipBytes = 0

for (const filePath of files) {
  const rawBuffer = readFileSync(filePath)
  totalRawBytes += rawBuffer.length

  const brotliBuffer = zlib.brotliCompressSync(rawBuffer, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    },
  })
  writeFileSync(`${filePath}.br`, brotliBuffer)
  totalBrotliBytes += brotliBuffer.length

  const gzipBuffer = zlib.gzipSync(rawBuffer, { level: 9 })
  writeFileSync(`${filePath}.gz`, gzipBuffer)
  totalGzipBytes += gzipBuffer.length
}

console.log(
  `[precompress-assets] Precompressed ${files.length} assets:\n` +
    `  Raw:    ${(totalRawBytes / 1024).toFixed(2)} KB (${totalRawBytes} bytes)\n` +
    `  Brotli: ${(totalBrotliBytes / 1024).toFixed(2)} KB (${totalBrotliBytes} bytes)\n` +
    `  Gzip:   ${(totalGzipBytes / 1024).toFixed(2)} KB (${totalGzipBytes} bytes)`,
)
