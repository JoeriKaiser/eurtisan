import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

export type CompactMessageEntry = string | Record<string, string>

function parseEntry(value: unknown): CompactMessageEntry {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]
    if (
      first &&
      typeof first === 'object' &&
      'match' in first &&
      first.match &&
      typeof first.match === 'object'
    ) {
      const normalized: Record<string, string> = {}
      for (const [mk, mv] of Object.entries(first.match)) {
        normalized[mk.replace(/^countPlural=/, '')] = String(mv)
      }
      return normalized
    }
  }
  return ''
}

function extractEntryPlaceholders(value: unknown): string[] {
  const found = new Set<string>()
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\{(\w+)\}/g)) {
      found.add(match[1])
    }
  } else if (Array.isArray(value) && value.length > 0) {
    found.add('count')
    const first = value[0]
    if (
      first &&
      typeof first === 'object' &&
      'match' in first &&
      first.match &&
      typeof first.match === 'object'
    ) {
      for (const mv of Object.values(first.match)) {
        for (const match of String(mv).matchAll(/\{(\w+)\}/g)) {
          found.add(match[1])
        }
      }
    }
  }
  return Array.from(found).sort()
}

function readConfiguredLocales(rootDir: string): string[] {
  const settingsPath = join(rootDir, 'project.inlang/settings.json')
  if (!existsSync(settingsPath)) return ['en']
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    if (
      settings &&
      typeof settings === 'object' &&
      'locales' in settings &&
      Array.isArray(settings.locales)
    ) {
      return settings.locales.filter((loc: unknown): loc is string => typeof loc === 'string')
    }
  } catch {
    // fallback to ['en']
  }
  return ['en']
}

export function ensureParaglideRuntimeProject(rootDir = process.cwd()): string {
  const runtimeDir = join(rootDir, '.inlang-runtime')
  const runtimeProjectDir = join(runtimeDir, 'project.inlang')
  const runtimeMessagesDir = join(runtimeDir, 'messages')

  mkdirSync(runtimeProjectDir, { recursive: true })
  mkdirSync(runtimeMessagesDir, { recursive: true })

  const sourceSettingsPath = join(rootDir, 'project.inlang/settings.json')
  const rawSettings = existsSync(sourceSettingsPath)
    ? JSON.parse(readFileSync(sourceSettingsPath, 'utf8'))
    : {}

  const runtimeSettings = {
    ...rawSettings,
    'plugin.inlang.messageFormat': {
      ...(rawSettings['plugin.inlang.messageFormat'] ?? {}),
      pathPattern: './messages/{locale}.json',
    },
  }

  const settingsFilePath = join(runtimeProjectDir, 'settings.json')
  const settingsContent = `${JSON.stringify(runtimeSettings, null, 2)}\n`
  if (!existsSync(settingsFilePath) || readFileSync(settingsFilePath, 'utf8') !== settingsContent) {
    writeFileSync(settingsFilePath, settingsContent, 'utf8')
  }

  const runtimeEnMessagesPath = join(runtimeMessagesDir, 'en.json')
  const runtimeEnMessagesContent =
    '{"$schema":"https://inlang.com/schema/inlang-message-format","_":""}\n'
  if (
    !existsSync(runtimeEnMessagesPath) ||
    readFileSync(runtimeEnMessagesPath, 'utf8') !== runtimeEnMessagesContent
  ) {
    writeFileSync(runtimeEnMessagesPath, runtimeEnMessagesContent, 'utf8')
  }

  return runtimeProjectDir
}

export interface OrderedKeysResult {
  clientKeys: string[]
  allKeys: string[]
  keyToIndex: Record<string, number>
  fallbackRaw: Record<string, unknown>
}

export function getOrderedMessageKeys(rootDir = process.cwd()): OrderedKeysResult {
  const fallbackPath = join(rootDir, 'messages/en.json')
  const fallbackRaw: Record<string, unknown> = existsSync(fallbackPath)
    ? JSON.parse(readFileSync(fallbackPath, 'utf8'))
    : {}

  const clientKeys: string[] = []
  const serverOnlyKeys: string[] = []

  for (const key of Object.keys(fallbackRaw).sort()) {
    if (key === '$schema') continue
    if (key.startsWith('email_')) {
      serverOnlyKeys.push(key)
    } else {
      clientKeys.push(key)
    }
  }

  const allKeys = [...clientKeys, ...serverOnlyKeys]
  const keyToIndex: Record<string, number> = {}
  for (let i = 0; i < allKeys.length; i++) {
    keyToIndex[allKeys[i]] = i
  }

  return { clientKeys, allKeys, keyToIndex, fallbackRaw }
}

export function buildSsrI18nVirtualModule(rootDir = process.cwd()): string {
  const { allKeys, keyToIndex, fallbackRaw } = getOrderedMessageKeys(rootDir)
  const enDense: CompactMessageEntry[] = new Array(allKeys.length)
  for (let i = 0; i < allKeys.length; i++) {
    enDense[i] = parseEntry(fallbackRaw[allKeys[i]])
  }

  return [
    "import { existsSync, readFileSync } from 'node:fs';",
    "import { join } from 'node:path';",
    "import { getLocale, experimentalStaticLocale } from '#/paraglide/runtime';",
    `const EN_CATALOG = ${JSON.stringify(enDense)};`,
    'const CATALOGS = { en: EN_CATALOG };',
    `const KEY_TO_INDEX = ${JSON.stringify(keyToIndex)};`,
    'const pluralRulesCache = {};',
    'const fnCache = [];',
    'function loadLocaleCatalog(locale) {',
    '  const existing = CATALOGS[locale];',
    '  if (existing) return existing;',
    "  const file = String(locale) + '.json';",
    "  const candidates = [join(process.cwd(), 'dist/client/i18n/ssr', file), join(process.cwd(), 'public/i18n/ssr', file)];",
    '  for (const p of candidates) {',
    '    if (existsSync(p)) {',
    '      try {',
    "        const loaded = JSON.parse(readFileSync(p, 'utf8'));",
    '        CATALOGS[locale] = loaded;',
    '        return loaded;',
    '      } catch {}',
    '    }',
    '  }',
    '  CATALOGS[locale] = EN_CATALOG;',
    '  return EN_CATALOG;',
    '}',
    'function getPluralRules(locale) {',
    '  let pr = pluralRulesCache[locale];',
    '  if (!pr) {',
    '    pr = new Intl.PluralRules(locale);',
    '    pluralRulesCache[locale] = pr;',
    '  }',
    '  return pr;',
    '}',
    'function formatTemplate(template, inputs) {',
    "  if (!inputs || !template.includes('{')) return template;",
    "  return template.replace(/\\{(\\w+)\\}/g, (_, k) => String(inputs[k] ?? ''));",
    '}',
    'function createAccessor(idx) {',
    '  return (inputs, options) => {',
    '    const locale = experimentalStaticLocale ?? options?.locale ?? getLocale();',
    '    const catalog = loadLocaleCatalog(locale);',
    '    const entry = catalog[idx] ?? EN_CATALOG[idx];',
    "    if (entry === undefined) return '';",
    "    if (typeof entry === 'string') return formatTemplate(entry, inputs);",
    '    const cat = getPluralRules(locale).select(Number(inputs?.count ?? 0));',
    "    const template = entry[cat] ?? entry.other ?? Object.values(entry)[0] ?? '';",
    '    return formatTemplate(template, inputs);',
    '  };',
    '}',
    'const m = new Proxy(fnCache, {',
    '  get(target, prop) {',
    "    const idx = typeof prop === 'string' && Object.hasOwn(KEY_TO_INDEX, prop) ? KEY_TO_INDEX[prop] : Number(prop);",
    '    if (Number.isInteger(idx) && idx >= 0) {',
    '      let fn = target[idx];',
    '      if (!fn) {',
    '        fn = createAccessor(idx);',
    '        target[idx] = fn;',
    '      }',
    '      return fn;',
    '    }',
    '    return () => String(prop);',
    '  }',
    '});',
    'export { m };',
    '',
  ].join('\n')
}

function emitParaglideMessagesArtifacts(rootDir: string, ordered: OrderedKeysResult): void {
  const paraglideDir = join(rootDir, 'src/paraglide')
  const messagesDir = join(paraglideDir, 'messages')
  if (!existsSync(paraglideDir)) return

  mkdirSync(messagesDir, { recursive: true })

  // Remove the 24 massive Paraglide locale .js files (300,000+ lines) so Vitest and tsc never parse them
  for (const entry of readdirSync(messagesDir)) {
    if (entry !== '_index.js' && entry !== '_index.d.ts') {
      rmSync(join(messagesDir, entry), { force: true })
    }
  }

  const ssrCode = buildSsrI18nVirtualModule(rootDir)
  writeFileSync(join(messagesDir, '_index.js'), ssrCode, 'utf8')
  writeFileSync(
    join(paraglideDir, 'messages.js'),
    "export { m } from './messages/_index.js';\n",
    'utf8',
  )

  // Generate fast .d.ts declarations in ~10ms instead of running tsc --declaration on 391k lines of JS
  const propLines: string[] = []
  for (const key of ordered.allKeys) {
    const placeholders = extractEntryPlaceholders(ordered.fallbackRaw[key])
    if (placeholders.length === 0) {
      propLines.push(
        `  readonly ${key}: (inputs?: Record<string, unknown>, options?: { locale?: string }) => string;`,
      )
    } else {
      const fields = placeholders.map((p) => `${p}: unknown`).join('; ')
      propLines.push(
        `  readonly ${key}: (inputs: { ${fields} }, options?: { locale?: string }) => string;`,
      )
    }
  }

  const dtsContent = ['export declare const m: {', ...propLines, '};', ''].join('\n')

  writeFileSync(join(messagesDir, '_index.d.ts'), dtsContent, 'utf8')
  writeFileSync(
    join(paraglideDir, 'messages.d.ts'),
    "export { m } from './messages/_index.js';\n",
    'utf8',
  )
}

interface CachedI18nManifest {
  fingerprint: string
  clientKeys: string[]
  allKeys: string[]
  keyToIndex: Record<string, number>
}

function computeI18nInputFingerprint(rootDir: string, locales: string[]): string {
  const trackedPaths = [
    join(rootDir, 'project.inlang/settings.json'),
    join(rootDir, 'scripts/compile-client-i18n.ts'),
    ...locales.map((locale) => join(rootDir, `messages/${locale}.json`)),
  ]
  return trackedPaths
    .map((filePath) => {
      if (!existsSync(filePath)) return `${filePath}:missing`
      const stat = statSync(filePath)
      return `${filePath}:${stat.size}:${stat.mtimeMs}`
    })
    .join('|')
}

function hasValidCompiledI18nOutputs(rootDir: string, locales: string[]): boolean {
  const paraglideDir = join(rootDir, 'src/paraglide')
  const messagesDir = join(paraglideDir, 'messages')
  if (existsSync(paraglideDir)) {
    if (
      !existsSync(join(paraglideDir, 'messages.js')) ||
      !existsSync(join(paraglideDir, 'messages.d.ts')) ||
      !existsSync(join(messagesDir, '_index.js')) ||
      !existsSync(join(messagesDir, '_index.d.ts'))
    ) {
      return false
    }
    // Re-run cleanup when `paraglide-js compile` emits per-locale JS modules.
    for (const entry of readdirSync(messagesDir)) {
      if (entry !== '_index.js' && entry !== '_index.d.ts') {
        return false
      }
    }
  }

  for (const locale of locales) {
    if (
      !existsSync(join(rootDir, 'public/i18n', `${locale}.js`)) ||
      !existsSync(join(rootDir, 'public/i18n/ssr', `${locale}.json`))
    ) {
      return false
    }
  }
  return true
}

export function compileClientI18nCatalogs(rootDir = process.cwd()): OrderedKeysResult {
  ensureParaglideRuntimeProject(rootDir)
  const locales = readConfiguredLocales(rootDir)
  const cachePath = join(rootDir, 'node_modules/.cache/eurtisan-i18n-manifest.json')
  const fingerprint = computeI18nInputFingerprint(rootDir, locales)

  if (
    !process.argv.includes('--force') &&
    existsSync(cachePath) &&
    hasValidCompiledI18nOutputs(rootDir, locales)
  ) {
    try {
      const cached = JSON.parse(readFileSync(cachePath, 'utf8')) as Partial<CachedI18nManifest>
      if (
        cached.fingerprint === fingerprint &&
        Array.isArray(cached.clientKeys) &&
        Array.isArray(cached.allKeys) &&
        cached.keyToIndex &&
        typeof cached.keyToIndex === 'object'
      ) {
        return {
          clientKeys: cached.clientKeys,
          allKeys: cached.allKeys,
          keyToIndex: cached.keyToIndex,
          fallbackRaw: {},
        }
      }
    } catch {
      // Fall through to full compilation when the cache file is unreadable.
    }
  }

  const ordered = getOrderedMessageKeys(rootDir)
  const { clientKeys, allKeys, keyToIndex, fallbackRaw } = ordered

  const outputDir = join(rootDir, 'public/i18n')
  const serverOutputDir = join(rootDir, 'public/i18n/ssr')
  mkdirSync(outputDir, { recursive: true })
  mkdirSync(serverOutputDir, { recursive: true })

  const legacyEnJson = join(outputDir, 'en.json')
  if (existsSync(legacyEnJson)) {
    rmSync(legacyEnJson, { force: true })
  }

  for (const locale of locales) {
    const localePath = join(rootDir, `messages/${locale}.json`)
    const raw: Record<string, unknown> = existsSync(localePath)
      ? JSON.parse(readFileSync(localePath, 'utf8'))
      : fallbackRaw

    const denseClientCatalog: CompactMessageEntry[] = new Array(clientKeys.length)
    for (let i = 0; i < clientKeys.length; i++) {
      const key = clientKeys[i]
      const val = Object.hasOwn(raw, key) ? raw[key] : fallbackRaw[key]
      denseClientCatalog[i] = parseEntry(val)
    }

    const denseServerCatalog: CompactMessageEntry[] = new Array(allKeys.length)
    for (let i = 0; i < allKeys.length; i++) {
      const key = allKeys[i]
      const val = Object.hasOwn(raw, key) ? raw[key] : fallbackRaw[key]
      denseServerCatalog[i] = parseEntry(val)
    }

    const jsContent = `window.__EURTISAN_I18N__=${JSON.stringify(denseClientCatalog)};\n`
    writeFileSync(join(outputDir, `${locale}.js`), jsContent, 'utf8')
    writeFileSync(
      join(serverOutputDir, `${locale}.json`),
      JSON.stringify(denseServerCatalog),
      'utf8',
    )
  }

  emitParaglideMessagesArtifacts(rootDir, ordered)

  if (existsSync(join(rootDir, 'node_modules'))) {
    try {
      mkdirSync(join(rootDir, 'node_modules/.cache'), { recursive: true })
      const manifest: CachedI18nManifest = { fingerprint, clientKeys, allKeys, keyToIndex }
      writeFileSync(cachePath, JSON.stringify(manifest), 'utf8')
    } catch {
      // Best-effort cache write
    }
  }

  return ordered
}

const meta = import.meta
if ('main' in meta && meta.main) {
  if (process.argv.includes('--prepare-runtime')) {
    ensureParaglideRuntimeProject()
  } else {
    compileClientI18nCatalogs()
  }
}
