import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory()
      ? collectTypeScriptFiles(path)
      : entry.isFile() && entry.name.endsWith('.ts')
        ? [path]
        : []
  })
}

describe('E2E hydration readiness contract', () => {
  const projectRoot = process.cwd()
  const e2eRoot = join(projectRoot, 'e2e')
  const hydrationHelper = join(e2eRoot, 'fixtures', 'hydration.ts')
  const consumers = collectTypeScriptFiles(e2eRoot).filter((path) => path !== hydrationHelper)

  it('keeps the readiness selector private to the shared helper', () => {
    const directSelectorConsumers = consumers
      .filter((path) => readFileSync(path, 'utf8').includes('html[data-hydrated="true"]'))
      .map((path) => relative(projectRoot, path))

    expect(directSelectorConsumers).toEqual([])
  })

  it('does not pair hydration readiness with a redundant network-idle wait', () => {
    const redundantWait =
      /await waitForAppHydration\(([$A-Z_a-z][$\w]*)\)\s*\n\s*await \1\.waitForLoadState\(['"]networkidle['"]\)/
    const offenders = consumers
      .filter((path) => redundantWait.test(readFileSync(path, 'utf8')))
      .map((path) => relative(projectRoot, path))

    expect(offenders).toEqual([])
  })
})
