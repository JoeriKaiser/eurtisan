import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { compileClientI18nCatalogs } from '../../scripts/compile-client-i18n'

const tempDirs: string[] = []

function createTempI18nProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'eurtisan-i18n-cache-'))
  tempDirs.push(root)

  mkdirSync(join(root, 'project.inlang'), { recursive: true })
  mkdirSync(join(root, 'messages'), { recursive: true })
  mkdirSync(join(root, 'src/paraglide/messages'), { recursive: true })
  mkdirSync(join(root, 'node_modules'), { recursive: true })

  writeFileSync(
    join(root, 'project.inlang/settings.json'),
    JSON.stringify({ locales: ['en', 'nl'] }),
  )
  writeFileSync(
    join(root, 'messages/en.json'),
    JSON.stringify({ greeting: 'Hello', email_welcome: 'Welcome' }),
  )
  writeFileSync(
    join(root, 'messages/nl.json'),
    JSON.stringify({ greeting: 'Hallo', email_welcome: 'Welkom' }),
  )
  return root
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('compileClientI18nCatalogs caching', () => {
  it('reuses cached manifest when inputs and outputs are unchanged', () => {
    const root = createTempI18nProject()
    const first = compileClientI18nCatalogs(root)
    expect(first.keyToIndex).toEqual({ greeting: 0, email_welcome: 1 })

    const outFile = join(root, 'public/i18n/en.js')
    const sentinelTime = new Date(1_700_000_000_000)
    utimesSync(outFile, sentinelTime, sentinelTime)

    const second = compileClientI18nCatalogs(root)
    expect(second.keyToIndex).toEqual(first.keyToIndex)
    // Cache hit leaves the already-generated output file untouched.
    expect(statSync(outFile).mtimeMs).toBe(sentinelTime.getTime())
    expect(readFileSync(outFile, 'utf8')).toContain('Hello')
    expect(existsSync(join(root, 'node_modules/.cache/eurtisan-i18n-manifest.json'))).toBe(true)
  })

  it('recompiles when a locale message changes or stray paraglide module appears', () => {
    const root = createTempI18nProject()
    compileClientI18nCatalogs(root)

    // Simulate `paraglide-js compile` writing a per-locale JS file before cleanup.
    const strayFile = join(root, 'src/paraglide/messages/en.js')
    writeFileSync(strayFile, 'export const greeting = () => "Hello";')
    compileClientI18nCatalogs(root)
    expect(existsSync(strayFile)).toBe(false)

    writeFileSync(
      join(root, 'messages/en.json'),
      JSON.stringify({ greeting: 'Hi there', email_welcome: 'Welcome' }),
    )
    const updated = compileClientI18nCatalogs(root)
    expect(updated.keyToIndex).toEqual({ greeting: 0, email_welcome: 1 })
    expect(readFileSync(join(root, 'public/i18n/en.js'), 'utf8')).toContain('Hi there')
  })
})
