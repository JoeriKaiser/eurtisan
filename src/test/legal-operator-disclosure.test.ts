import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getOperatorBillingParty, getOperatorProfile } from '#/lib/legal/operator.server'

const REPO_ROOT = join(import.meta.dirname, '../..')

function readLocale(locale: string): Record<string, string> {
  return JSON.parse(readFileSync(join(REPO_ROOT, `messages/${locale}.json`), 'utf8'))
}

describe('legal operator disclosures and billing identity', () => {
  it('supplies a complete operator profile and billing party', () => {
    const profile = getOperatorProfile()
    expect(profile.name).toBeDefined()
    expect(profile.email).toBeDefined()
    expect(profile.billingEmail).toBeDefined()
    expect(profile.vatId).toBeDefined()
    expect(profile.address.country).toBeDefined()
    expect(profile.formattedAddress).toContain(profile.address.city)

    const billingParty = getOperatorBillingParty()
    expect(billingParty.name).toBe(profile.name)
    expect(billingParty.email).toBe(profile.billingEmail)
    expect(billingParty.vatId).toBe(profile.vatId)
    expect(billingParty.address.country).toBe(profile.address.country)
  })

  it('keeps translation fallbacks neutral across all locales', () => {
    for (const locale of ['en', 'nl']) {
      const messages = readLocale(locale)
      expect(messages.legal_operator_name).toBe('Eurtisan')
      expect(messages.legal_contact_email).toBe('legal@eurtisan.eu')
      expect(messages.legal_vat_number).toBe('FR00000000000')
      expect(messages.invoice_disclosure_platform_fee_desc).toContain('{operator}')

      // Ensure no residential or personal address remains in static translations
      expect(JSON.stringify(messages)).not.toContain('5 Chemin de Gramont')
      expect(JSON.stringify(messages)).not.toContain('Joeri Kaiser')
    }
  })
})
