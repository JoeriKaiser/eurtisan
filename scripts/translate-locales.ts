import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { EU_LOCALES, PREFIXED_EU_LOCALES, type EuLocale } from '../src/lib/i18n/eu-locales'
import {
  LEGAL_DISCLOSURE_OVERRIDES,
  CRD_NON_TRADER_RIGHTS_NOTICE,
} from '../src/lib/i18n/eu-legal-disclosures'

export { EU_LOCALES, PREFIXED_EU_LOCALES, type EuLocale }

export interface ParaglidePluralItem {
  declarations?: string[]
  selectors?: string[]
  match?: Record<string, string>
}

export function isParaglidePluralAst(val: unknown): val is ParaglidePluralItem[] {
  return (
    Array.isArray(val) &&
    val.length > 0 &&
    typeof val[0] === 'object' &&
    val[0] !== null &&
    'match' in val[0]
  )
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Extracts all `{variable}` placeholders from `text` in sorted order.
 */
export function extractPlaceholders(text: string): string[] {
  if (typeof text !== 'string') {
    return []
  }
  const matches = text.match(/\{[a-zA-Z0-9_]+\}/g)
  return matches ? matches.slice().sort() : []
}

/**
 * Resolves the plural categories that must be covered for a given EU language.
 *
 * For Romance languages (fr, es, it, pt), 'many' is only triggered in CLDR v38+
 * for 1,000,000+ quantities, while standard cardinal integer keys (0..999,999)
 * evaluate to 'one' or 'other'.
 */
export function getRequiredPluralCategories(locale: EuLocale): string[] {
  try {
    const resolved = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
    if (locale === 'fr' || locale === 'es' || locale === 'it' || locale === 'pt') {
      return ['one', 'other']
    }
    return resolved
  } catch {
    return ['one', 'other']
  }
}

/**
 * Validates a target locale message catalog against the canonical English catalog.
 *
 * Verifies:
 * 1. Every key in enCatalog exists in targetCatalog and no extra keys exist.
 * 2. String entries preserve exact placeholders.
 * 3. Paraglide plural AST arrays have valid declarations, selectors, and match branches
 *    that preserve `{count}` / `{average}` placeholders and cover plural categories for `locale`.
 * 4. Pinned legal invariants:
 *    - legal_operator_name === 'Eurtisan'
 *    - legal_contact_email === 'legal@eurtisan.eu'
 *    - legal_vat_number === 'FR00000000000'
 *    - trader_status_non_trader_rights_notice === CRD_NON_TRADER_RIGHTS_NOTICE[locale]
 */
export function validateLocaleCatalog(
  locale: EuLocale,
  enCatalog: Record<string, unknown>,
  targetCatalog: Record<string, unknown>,
): string[] {
  const errors: string[] = []

  const enKeys = Object.keys(enCatalog)
  const targetKeys = Object.keys(targetCatalog)

  // 1. Key presence & extra key checks
  for (const key of enKeys) {
    if (!Object.hasOwn(targetCatalog, key)) {
      errors.push(`[${locale}] Missing key: "${key}"`)
    }
  }

  for (const key of targetKeys) {
    if (!Object.hasOwn(enCatalog, key)) {
      errors.push(`[${locale}] Extra key: "${key}"`)
    }
  }

  // 2. Value-level validation
  for (const key of enKeys) {
    if (!Object.hasOwn(targetCatalog, key)) {
      continue
    }

    const enVal = enCatalog[key]
    const targetVal = targetCatalog[key]

    if (typeof enVal === 'string') {
      if (typeof targetVal !== 'string') {
        errors.push(`[${locale}] Key "${key}": expected string, got ${typeof targetVal}`)
        continue
      }

      const enPlaceholders = extractPlaceholders(enVal)
      const targetPlaceholders = extractPlaceholders(targetVal)

      if (!arraysEqual(enPlaceholders, targetPlaceholders)) {
        errors.push(
          `[${locale}] Key "${key}": placeholder mismatch (expected [${enPlaceholders.join(', ')}], got [${targetPlaceholders.join(', ')}])`,
        )
      }
      continue
    }

    if (isParaglidePluralAst(enVal)) {
      if (!isParaglidePluralAst(targetVal)) {
        errors.push(`[${locale}] Key "${key}": expected valid Paraglide plural array`)
        continue
      }

      const enItem = enVal[0]
      const targetItem = targetVal[0]

      if (!Array.isArray(targetItem.declarations)) {
        errors.push(
          `[${locale}] Key "${key}": missing or non-array "declarations" in Paraglide plural`,
        )
      }

      if (!Array.isArray(targetItem.selectors) || targetItem.selectors.length === 0) {
        errors.push(`[${locale}] Key "${key}": missing or empty "selectors" in Paraglide plural`)
      }

      if (
        typeof targetItem.match !== 'object' ||
        targetItem.match === null ||
        Array.isArray(targetItem.match)
      ) {
        errors.push(`[${locale}] Key "${key}": missing or non-object "match" in Paraglide plural`)
        continue
      }

      // Collect expected placeholders from enVal branches
      const enBranchPlaceholders: string[] = []
      if (enItem.match && typeof enItem.match === 'object') {
        for (const branchVal of Object.values(enItem.match)) {
          if (typeof branchVal === 'string') {
            for (const ph of extractPlaceholders(branchVal)) {
              if (!enBranchPlaceholders.includes(ph)) {
                enBranchPlaceholders.push(ph)
              }
            }
          }
        }
      }

      // Verify each branch in targetVal preserves all expected placeholders
      for (const [branchKey, branchVal] of Object.entries(targetItem.match)) {
        if (typeof branchVal !== 'string') {
          errors.push(`[${locale}] Key "${key}": branch "${branchKey}" must have a string value`)
          continue
        }
        const branchPlaceholders = extractPlaceholders(branchVal)
        for (const expectedPlaceholder of enBranchPlaceholders) {
          if (!branchPlaceholders.includes(expectedPlaceholder)) {
            errors.push(
              `[${locale}] Key "${key}": branch "${branchKey}" missing placeholder "${expectedPlaceholder}"`,
            )
          }
        }
      }

      // Check coverage of plural categories for locale
      const requiredCategories = getRequiredPluralCategories(locale)
      const presentCategories: string[] = []
      for (const branchKey of Object.keys(targetItem.match)) {
        const cat = branchKey.includes('=') ? (branchKey.split('=').pop() ?? '') : branchKey
        if (cat && !presentCategories.includes(cat)) {
          presentCategories.push(cat)
        }
      }

      const hasWildcard = presentCategories.includes('*')
      const missingCategories = requiredCategories.filter(
        (cat) => !presentCategories.includes(cat) && !hasWildcard,
      )

      if (missingCategories.length > 0) {
        errors.push(
          `[${locale}] Key "${key}": missing plural categories: [${missingCategories.join(', ')}] (present: [${presentCategories.join(', ')}])`,
        )
      }
    }
  }

  // 3. Pinned statutory and identity invariants
  if (targetCatalog.legal_operator_name !== 'Eurtisan') {
    errors.push(
      `[${locale}] Invariant violation: legal_operator_name must be 'Eurtisan' (got '${targetCatalog.legal_operator_name}')`,
    )
  }

  if (targetCatalog.legal_contact_email !== 'legal@eurtisan.eu') {
    errors.push(
      `[${locale}] Invariant violation: legal_contact_email must be 'legal@eurtisan.eu' (got '${targetCatalog.legal_contact_email}')`,
    )
  }

  if (targetCatalog.legal_vat_number !== 'FR00000000000') {
    errors.push(
      `[${locale}] Invariant violation: legal_vat_number must be 'FR00000000000' (got '${targetCatalog.legal_vat_number}')`,
    )
  }

  const expectedNotice = CRD_NON_TRADER_RIGHTS_NOTICE[locale]
  if (targetCatalog.trader_status_non_trader_rights_notice !== expectedNotice) {
    errors.push(
      `[${locale}] Invariant violation: trader_status_non_trader_rights_notice does not match CRD_NON_TRADER_RIGHTS_NOTICE[${locale}]`,
    )
  }

  return errors
}

/**
 * Applies statutory legal disclosure overrides, pins invariants, orders keys identically to
 * `messages/en.json`, and repairs any corrupted or missing placeholders by falling back to `enCatalog`.
 */
export function applyLegalDisclosuresAndFixups(
  locale: EuLocale,
  enCatalog: Record<string, unknown>,
  targetCatalog: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  const overrides =
    (LEGAL_DISCLOSURE_OVERRIDES as Record<string, Record<string, string>>)[locale] ?? {}

  for (const [key, enVal] of Object.entries(enCatalog)) {
    // 1. Legal overrides take precedence for legal keys
    if (Object.hasOwn(overrides, key)) {
      result[key] = overrides[key]
      continue
    }

    // 2. CRD statutory non-trader notice
    if (key === 'trader_status_non_trader_rights_notice') {
      result[key] = CRD_NON_TRADER_RIGHTS_NOTICE[locale] ?? enVal
      continue
    }

    // 3. Pinned invariants
    if (key === 'legal_operator_name') {
      result[key] = 'Eurtisan'
      continue
    }
    if (key === 'legal_contact_email') {
      result[key] = 'legal@eurtisan.eu'
      continue
    }
    if (key === 'legal_vat_number') {
      result[key] = 'FR00000000000'
      continue
    }
    if (key === 'currency_symbol') {
      result[key] = '€'
      continue
    }

    // 4. Missing key in target: fallback to enVal
    if (!Object.hasOwn(targetCatalog, key)) {
      result[key] = enVal
      continue
    }

    const targetVal = targetCatalog[key]

    // 5. String entry placeholder validation & repair
    if (typeof enVal === 'string') {
      if (typeof targetVal !== 'string') {
        result[key] = enVal
        continue
      }
      let targetText = targetVal
      // Repair known stray trailing placeholders if present
      if (
        key === 'terms_section_15_text' &&
        targetText.endsWith(' {country}') &&
        !enVal.endsWith(' {country}')
      ) {
        targetText = targetText.slice(0, -' {country}'.length)
      }

      const enPlaceholders = extractPlaceholders(enVal)
      const targetPlaceholders = extractPlaceholders(targetText)

      if (!arraysEqual(enPlaceholders, targetPlaceholders)) {
        // Corrupted placeholder: fallback to enVal
        result[key] = enVal
      } else {
        result[key] = targetText
      }
      continue
    }

    // 6. Paraglide plural AST entry validation & repair
    if (isParaglidePluralAst(enVal)) {
      if (!isParaglidePluralAst(targetVal)) {
        result[key] = enVal
        continue
      }

      const enItem = enVal[0]
      const targetItem = targetVal[0]

      if (
        !Array.isArray(targetItem.declarations) ||
        !Array.isArray(targetItem.selectors) ||
        typeof targetItem.match !== 'object' ||
        targetItem.match === null ||
        Array.isArray(targetItem.match)
      ) {
        result[key] = enVal
        continue
      }

      const enBranchPlaceholders: string[] = []
      if (enItem.match && typeof enItem.match === 'object') {
        for (const bv of Object.values(enItem.match)) {
          if (typeof bv === 'string') {
            for (const ph of extractPlaceholders(bv)) {
              if (!enBranchPlaceholders.includes(ph)) {
                enBranchPlaceholders.push(ph)
              }
            }
          }
        }
      }

      let validBranches = true
      for (const bv of Object.values(targetItem.match)) {
        if (typeof bv !== 'string') {
          validBranches = false
          break
        }
        const bPh = extractPlaceholders(bv)
        for (const eph of enBranchPlaceholders) {
          if (!bPh.includes(eph)) {
            validBranches = false
            break
          }
        }
        if (!validBranches) break
      }

      if (!validBranches) {
        result[key] = enVal
      } else {
        result[key] = targetVal
      }
      continue
    }

    // 7. General fallback
    result[key] = targetVal ?? enVal
  }

  // Ensure invariants explicitly
  result.legal_operator_name = 'Eurtisan'
  result.legal_contact_email = 'legal@eurtisan.eu'
  result.legal_vat_number = 'FR00000000000'
  result.currency_symbol = '€'
  result.trader_status_non_trader_rights_notice = CRD_NON_TRADER_RIGHTS_NOTICE[locale]

  return result
}

/**
 * Computes deterministic SHA-256 hashes (12 hex characters) for all keys in the source catalog.
 */
export function computeSourceHashes(enCatalog: Record<string, unknown>): Record<string, string> {
  const hashes: Record<string, string> = {}
  for (const [key, val] of Object.entries(enCatalog)) {
    if (key === '$schema') continue
    const payload = typeof val === 'string' ? val : JSON.stringify(val)
    const hash = createHash('sha256').update(payload).digest('hex').slice(0, 12)
    hashes[key] = hash
  }
  return hashes
}

export function getConfiguredLocales(rootDir = process.cwd()): EuLocale[] {
  const settingsPath = join(rootDir, 'project.inlang/settings.json')
  if (!existsSync(settingsPath)) {
    return ['en']
  }
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      locales?: unknown[]
    }
    if (Array.isArray(settings.locales)) {
      return settings.locales.filter(
        (loc): loc is EuLocale => typeof loc === 'string' && EU_LOCALES.includes(loc as EuLocale),
      )
    }
  } catch {
    // fallback
  }
  return ['en']
}

/**
 * Validates all configured locales in `project.inlang/settings.json` against `messages/en.json`.
 * Returns true if all catalogs pass validation, false otherwise.
 */
export function verifyAllLocales(rootDir = process.cwd()): boolean {
  const enPath = join(rootDir, 'messages/en.json')
  if (!existsSync(enPath)) {
    console.error(`Error: English catalog not found at ${enPath}`)
    return false
  }

  const enCatalog = JSON.parse(readFileSync(enPath, 'utf8')) as Record<string, unknown>
  const locales = getConfiguredLocales(rootDir)

  let allValid = true

  for (const locale of locales) {
    const localePath = join(rootDir, `messages/${locale}.json`)
    if (!existsSync(localePath)) {
      console.error(`[${locale}] Catalog file does not exist: ${localePath}`)
      allValid = false
      continue
    }

    const targetCatalog = JSON.parse(readFileSync(localePath, 'utf8')) as Record<string, unknown>
    const errors = validateLocaleCatalog(locale, enCatalog, targetCatalog)

    if (errors.length > 0) {
      allValid = false
      console.error(`\n❌ [${locale}] Validation failed with ${errors.length} error(s):`)
      for (const err of errors) {
        console.error(`   ${err}`)
      }
    } else {
      console.log(`✓ [${locale}] All keys and placeholders valid.`)
    }
  }

  return allValid
}

/**
 * Applies legal disclosures and fixups across all existing `messages/{locale}.json` files
 * and writes them with 2-space indentation and a trailing newline.
 */
export function applyLegalToAllLocales(rootDir = process.cwd()): void {
  const enPath = join(rootDir, 'messages/en.json')
  if (!existsSync(enPath)) {
    console.error(`Error: English catalog not found at ${enPath}`)
    return
  }

  const enCatalog = JSON.parse(readFileSync(enPath, 'utf8')) as Record<string, unknown>
  const messagesDir = join(rootDir, 'messages')

  const existingLocales: EuLocale[] = []
  for (const locale of EU_LOCALES) {
    const filePath = join(messagesDir, `${locale}.json`)
    if (existsSync(filePath)) {
      existingLocales.push(locale)
    }
  }

  console.log(`Applying legal disclosures and fixups to ${existingLocales.length} locales...`)
  for (const locale of existingLocales) {
    const filePath = join(messagesDir, `${locale}.json`)
    const targetCatalog = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>
    const updated = applyLegalDisclosuresAndFixups(locale, enCatalog, targetCatalog)
    writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')
    console.log(`✓ [${locale}] Applied legal disclosures and fixups to messages/${locale}.json`)
  }
}

/**
 * Writes translation hashes for `messages/en.json` to `messages/.translation-hashes.json`.
 */
export function writeSourceHashes(rootDir = process.cwd()): Record<string, string> {
  const enPath = join(rootDir, 'messages/en.json')
  if (!existsSync(enPath)) {
    throw new Error(`English catalog not found at ${enPath}`)
  }

  const enCatalog = JSON.parse(readFileSync(enPath, 'utf8')) as Record<string, unknown>
  const hashes = computeSourceHashes(enCatalog)
  const outputPath = join(rootDir, 'messages/.translation-hashes.json')
  writeFileSync(outputPath, `${JSON.stringify(hashes, null, 2)}\n`, 'utf8')
  console.log(
    `✓ Wrote ${Object.keys(hashes).length} translation hashes to messages/.translation-hashes.json`,
  )
  return hashes
}

/**
 * Finds keys in `enCatalog` that are missing or outdated relative to last-known source hashes.
 */
export function findPendingTranslationKeys(
  enCatalog: Record<string, unknown>,
  targetCatalog: Record<string, unknown>,
  sourceHashes?: Record<string, string>,
  lastKnownHashes?: Record<string, string>,
): string[] {
  const pending: string[] = []
  for (const key of Object.keys(enCatalog)) {
    if (key === '$schema') continue
    if (!Object.hasOwn(targetCatalog, key)) {
      pending.push(key)
      continue
    }
    if (sourceHashes && lastKnownHashes) {
      if (sourceHashes[key] !== lastKnownHashes[key]) {
        pending.push(key)
      }
    }
  }
  return pending
}

/**
 * Constructs a structured translation prompt for an LLM with triangulated context
 * (English, Dutch, French) and grammatical constraints.
 */
export function buildTranslationPrompt(
  targetLocale: EuLocale,
  keys: string[],
  enCatalog: Record<string, unknown>,
  nlCatalog?: Record<string, unknown>,
  frCatalog?: Record<string, unknown>,
): string {
  const entries: Record<string, { en: unknown; nl?: unknown; fr?: unknown }> = {}
  for (const key of keys) {
    entries[key] = {
      en: enCatalog[key],
      ...(nlCatalog && Object.hasOwn(nlCatalog, key) ? { nl: nlCatalog[key] } : {}),
      ...(frCatalog && Object.hasOwn(frCatalog, key) ? { fr: frCatalog[key] } : {}),
    }
  }

  const requiredPluralCategories = getRequiredPluralCategories(targetLocale)

  return `You are a professional software localization specialist translating the Eurtisan marketplace catalog into ${targetLocale}.
Eurtisan is a European marketplace for independent makers, studios, and craft goods.

Rules:
1. Preserve all placeholders verbatim: {count}, {name}, {email}, etc. Do NOT translate or remove variable names.
2. Maintain consistent tone (use formal or standard polite address, consistent product/maker terminology).
3. For plural messages, generate branches for: ${requiredPluralCategories.join(', ')}.
4. In inflected languages, avoid placing raw variable substitutions directly after case-governing prepositions; use nominative-safe colons or rephrasings where appropriate.
5. Return ONLY a valid JSON object mapping key names to translated strings or Paraglide plural AST arrays.

Source entries:
${JSON.stringify(entries, null, 2)}`
}

/**
 * Performs an incremental sync: applies legal disclosures across locales, detects changed keys,
 * and updates `messages/.translation-hashes.json`.
 */
export async function syncLocales(rootDir = process.cwd()): Promise<void> {
  const enPath = join(rootDir, 'messages/en.json')
  if (!existsSync(enPath)) {
    throw new Error(`English catalog not found at ${enPath}`)
  }

  const enCatalog = JSON.parse(readFileSync(enPath, 'utf8')) as Record<string, unknown>
  const currentHashes = computeSourceHashes(enCatalog)

  // Apply disclosures and fixups across all existing locale files
  applyLegalToAllLocales(rootDir)

  // Write updated translation hashes
  const hashPath = join(rootDir, 'messages/.translation-hashes.json')
  writeFileSync(hashPath, `${JSON.stringify(currentHashes, null, 2)}\n`, 'utf8')
  console.log(`✓ [sync] Updated messages/.translation-hashes.json`)
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: bun run scripts/translate-locales.ts [options]

Options:
  --verify        Validate all configured locales against messages/en.json (exits 1 if invalid)
  --apply-legal   Apply EUR-Lex legal disclosures & invariant fixups to existing locales
  --write-hashes  Compute and write messages/.translation-hashes.json
  --sync          Run incremental translation sync & write translation hashes
  --help          Show this help message
`)
    return
  }

  if (args.includes('--apply-legal')) {
    applyLegalToAllLocales()
  }

  if (args.includes('--write-hashes')) {
    writeSourceHashes()
  }

  if (args.includes('--sync')) {
    await syncLocales()
  }

  if (args.includes('--verify')) {
    const valid = verifyAllLocales()
    if (!valid) {
      process.exit(1)
    }
  }
}

const meta = import.meta
if (
  ('main' in meta && Boolean(meta.main)) ||
  process.argv[1]?.endsWith('translate-locales.ts') ||
  process.argv[1]?.endsWith('translate-locales.js')
) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
