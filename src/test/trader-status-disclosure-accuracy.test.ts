import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Keeps the public CRD Article 6a seller-status disclosure tied to the seller's
 * actual declaration. A DAC7 legal-entity type is tax data, not a statement of
 * whether the seller acts as a trader; deriving one from the other would make a
 * buyer-facing legal claim false. Likewise, omitting the non-trader consequence
 * would leave the declaration materially incomplete.
 *
 * This is intentionally a source-accuracy test. The declaration is stored and
 * projected in server-only code while the legal wording is translated UI text,
 * so no ordinary component test can prove the two stay coupled. If it fails,
 * repair the disclosure or projection in both locales rather than weakening the
 * assertion.
 */

const REPO_ROOT = join(import.meta.dirname, '../..')
const LOCALES = ['en', 'nl'] as const

function readSource(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8')
}

const traderStatusContract = readSource('src/lib/shops/trader-status.ts')
const schema = readSource('src/db/schema.ts')
const publicProfile = readSource('src/lib/shops/public-profile.server.ts')
const productProjection = readSource('src/lib/products/operations.server.ts')
const checkoutSummary = readSource('src/lib/checkout/summary.server.ts')
const disclosure = readSource('src/components/TraderStatusDisclosure.tsx')
const messages: Record<(typeof LOCALES)[number], Record<string, string>> = {
  en: JSON.parse(readSource('messages/en.json')) as Record<string, string>,
  nl: JSON.parse(readSource('messages/nl.json')) as Record<string, string>,
}

const DECLARATION_MESSAGE_KEYS = [
  'trader_status_trader',
  'trader_status_non_trader',
  'trader_status_undeclared',
] as const

const NON_TRADER_CONSEQUENCE_KEY = 'trader_status_non_trader_rights_notice'

describe('trader-status disclosure accuracy', () => {
  it('renders every declaration state and the non-trader consequence in both locales', () => {
    for (const key of [...DECLARATION_MESSAGE_KEYS, NON_TRADER_CONSEQUENCE_KEY]) {
      expect(disclosure).toContain(`m.${key}()`)
      for (const locale of LOCALES) {
        expect(messages[locale][key]?.trim().length ?? 0).toBeGreaterThan(0)
      }
    }

    // The consequence is conditional: it belongs to a non-trader contract, not
    // to the trader or legacy-declaration notices.
    expect(disclosure).toContain("traderStatus === 'non_trader'")
    expect(messages.en[NON_TRADER_CONSEQUENCE_KEY]).toBe(
      'Consumer rights stemming from EU consumer protection law do not apply to the contract.',
    )
    expect(messages.nl[NON_TRADER_CONSEQUENCE_KEY]).toBe(
      'De consumentenrechtenbescherming die uit het Unierecht voortvloeit, is niet van toepassing op de overeenkomst.',
    )
  })

  it('uses only the explicit stored declaration for every buyer-facing projection', () => {
    expect(traderStatusContract).toContain("TRADER_STATUSES = ['trader', 'non_trader']")
    expect(schema).toContain('traderStatus: traderStatusEnum')

    // These are the three paths a buyer can reach: storefront, product, and
    // checkout. Each must pass through the persisted declaration unchanged.
    expect(publicProfile).toContain('traderStatus: shop.traderStatus')
    expect(publicProfile).toContain('traderStatus: row.traderStatus')
    expect(productProjection).toContain('traderStatus: shop.traderStatus')
    expect(productProjection).toContain('traderStatus: result.traderStatus')
    expect(checkoutSummary).toContain('traderStatus: shopRecord.traderStatus')

    // No path may transform DAC7 classification into the declaration. Comments
    // may name `legalEntityType` to document its exclusion, so pin executable
    // inference shapes rather than banning the identifier from source text.
    for (const source of [disclosure, publicProfile, productProjection, checkoutSummary]) {
      expect(source).not.toMatch(/traderStatus\s*:[^\n]*legalEntityType/)
      expect(source).not.toMatch(/legalEntityType\s*===\s*['"][^'"]+['"][^\n]*traderStatus/)
    }
  })
})
