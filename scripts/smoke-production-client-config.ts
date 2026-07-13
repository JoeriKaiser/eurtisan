import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import {
  parsePublicBuildEnvironment,
  toPublicEnvironmentManifest,
} from '../src/lib/infra/public-environment'

const clientDirectory = new URL('../dist/client/', import.meta.url)
const expected = toPublicEnvironmentManifest(parsePublicBuildEnvironment(process.env))
const manifest = JSON.parse(
  await readFile(new URL('client-config.json', clientDirectory), 'utf8'),
) as Record<string, unknown>

const failures: string[] = []
for (const [name, value] of Object.entries(expected)) {
  if ((manifest[name] ?? '') !== (value ?? '')) {
    failures.push(`${name} does not match the validated build value`)
  }
}

const forbiddenPatterns: Array<[string, RegExp]> = [
  ['localhost URL', /https?:\\?\/\\?\/(?:localhost|127\.|0\.0\.0\.0|\[::1\])/i],
  ['internal Docker URL', /https?:\\?\/\\?\/(?:db|garage|imgproxy|meilisearch)(?::|\\?\/)/i],
  [
    'placeholder value',
    /(?:^|[^a-z])(?:change[-_ ]?me|your[-_ ](?:key|token|secret)|replace[-_ ]?me|placeholder-key|dummy-key)(?=$|[^a-z])/i,
  ],
]

const markerList = (process.env.CLIENT_SMOKE_FORBIDDEN_MARKERS ?? '')
  .split(',')
  .map((marker) => marker.trim())
  .filter((marker) => marker.length >= 8)

async function collectAssetFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? collectAssetFiles(path) : [path]
    }),
  )
  return files.flat()
}

const files = await collectAssetFiles(clientDirectory.pathname)
for (const file of files) {
  if (!['.js', '.mjs', '.css', '.html', '.json', '.map'].includes(extname(file))) continue
  const content = await readFile(file, 'utf8')
  for (const [description, pattern] of forbiddenPatterns) {
    if (pattern.test(content))
      failures.push(`${description} found in ${file.replace(clientDirectory.pathname, '')}`)
  }
  for (const marker of markerList) {
    if (content.includes(marker)) {
      failures.push(`server-secret marker found in ${file.replace(clientDirectory.pathname, '')}`)
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Compiled client configuration smoke test failed:\n- ${failures.join('\n- ')}`)
}

console.log(`Compiled client configuration smoke test passed (${files.length} assets inspected).`)
