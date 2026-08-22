import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the two `shop` jsonb columns that are encrypted at rest.
 *
 * `shippingOrigin` and `businessAddress` are written with `encryptJsonb`
 * (`src/lib/shops/settings.server.ts`). `decryptJsonb` passes plaintext through
 * unchanged so legacy rows keep working — which means a read site that forgets
 * to decrypt does not throw. It receives a base64 string, every property access
 * on it yields `undefined`, and the failure is silent.
 *
 * That is not hypothetical. Ten sites shipped this way across checkout,
 * invoicing, fulfillment, shop settings, and the homepage stats, including the
 * `sellerCountry` that decides VAT reverse charge. Nothing caught it because
 * the seed and the test factories both wrote plaintext, so every non-production
 * environment took the legacy-passthrough branch.
 *
 * A static check rather than a behavioural one: it covers read sites that have
 * no test of their own, which is exactly where the bugs were.
 */

const ENCRYPTED_COLUMNS = ['shippingOrigin', 'businessAddress', 'billingDetails'] as const

/** `x.shippingOrigin as SomeType` — a cast that skips decryption. */
const RAW_CAST = new RegExp(`\\.(${ENCRYPTED_COLUMNS.join('|')})\\s+as\\s`, 'g')

/** `shipping_origin->>'country'` — SQL cannot see inside the ciphertext. */
const SQL_EXTRACTION =
  /(shippingOrigin|shipping_origin|businessAddress|business_address|billingDetails|billing_details)\s*}?\s*->>/g

/**
 * Files allowed to name these columns without decrypting.
 *
 * `legal-identity.ts` takes `unknown` and is called only with already-decrypted
 * values. The seed reads back its own in-memory plaintext, before the encrypting
 * insert. Both are deliberate; anything else added here needs a reason.
 */
const ALLOWED = new Set([
  'src/lib/shops/legal-identity.ts',
  'src/db/seed.ts',
  'src/test/encrypted-column-reads.test.ts',
])

const REPO_ROOT = join(import.meta.dirname, '../..')

function sourceFiles(directory = join(REPO_ROOT, 'src')): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) {
      found.push(...sourceFiles(absolute))
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(absolute)
    }
  }
  return found
}

function scanFor(pattern: RegExp): string[] {
  const offenders: string[] = []
  for (const absolute of sourceFiles()) {
    const path = relative(REPO_ROOT, absolute)
    if (ALLOWED.has(path)) continue
    const contents = readFileSync(absolute, 'utf8')
    for (const match of contents.matchAll(pattern)) {
      const line = contents.slice(0, match.index).split('\n').length
      offenders.push(`${path}:${line} — ${match[0].trim()}`)
    }
  }
  return offenders
}

describe('encrypted shop columns', () => {
  it('are never read with a raw cast that skips decryption', () => {
    expect(scanFor(RAW_CAST)).toEqual([])
  })

  it('are never queried with SQL json extraction, which cannot read ciphertext', () => {
    expect(scanFor(SQL_EXTRACTION)).toEqual([])
  })
})
