import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

export function compileClientI18nCatalogs(rootDir = process.cwd()): OrderedKeysResult {
  const locales = readConfiguredLocales(rootDir)
  const ordered = getOrderedMessageKeys(rootDir)
  const { clientKeys, allKeys, fallbackRaw } = ordered

  const outputDir = join(rootDir, 'public/i18n')
  const serverOutputDir = join(rootDir, 'public/i18n/ssr')
  mkdirSync(outputDir, { recursive: true })
  mkdirSync(serverOutputDir, { recursive: true })

  // Remove legacy unused en.json if present
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

  return ordered
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

const meta = import.meta
if ('main' in meta && meta.main) {
  compileClientI18nCatalogs()
}
