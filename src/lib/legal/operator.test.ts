import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getOperatorBillingParty, getOperatorProfile } from './operator.server'

describe('operator profile domain module', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.OPERATOR_LEGAL_NAME
    delete process.env.OPERATOR_LEGAL_EMAIL
    delete process.env.OPERATOR_BILLING_EMAIL
    delete process.env.OPERATOR_VAT_ID
    delete process.env.OPERATOR_STREET
    delete process.env.OPERATOR_CITY
    delete process.env.OPERATOR_POSTAL_CODE
    delete process.env.OPERATOR_COUNTRY
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns default fallback values when environment variables are unset', () => {
    const profile = getOperatorProfile()
    expect(profile.name).toBe('Eurtisan Platform')
    expect(profile.email).toBe('legal@eurtisan.eu')
    expect(profile.billingEmail).toBe('billing@eurtisan.eu')
    expect(profile.vatId).toBe('FR00000000000')
    expect(profile.address.street).toBe('1 Place de la République')
    expect(profile.address.city).toBe('Paris')
    expect(profile.address.postalCode).toBe('75001')
    expect(profile.address.country).toBe('FR')
    expect(profile.formattedAddress).toBe('1 Place de la République, 75001 Paris, France')

    const billingParty = getOperatorBillingParty()
    expect(billingParty.name).toBe('Eurtisan Platform')
    expect(billingParty.email).toBe('billing@eurtisan.eu')
    expect(billingParty.vatId).toBe('FR00000000000')
    expect(billingParty.address.country).toBe('FR')
  })

  it('reads configured values from environment variables', () => {
    process.env.OPERATOR_LEGAL_NAME = 'Custom Artisan SAS'
    process.env.OPERATOR_LEGAL_EMAIL = 'contact@custom.eu'
    process.env.OPERATOR_BILLING_EMAIL = 'invoices@custom.eu'
    process.env.OPERATOR_VAT_ID = 'FR99887766554'
    process.env.OPERATOR_STREET = '42 Boulevard Saint-Michel'
    process.env.OPERATOR_CITY = 'Lyon'
    process.env.OPERATOR_POSTAL_CODE = '69002'
    process.env.OPERATOR_COUNTRY = 'FR'

    const profile = getOperatorProfile()
    expect(profile.name).toBe('Custom Artisan SAS')
    expect(profile.email).toBe('contact@custom.eu')
    expect(profile.billingEmail).toBe('invoices@custom.eu')
    expect(profile.vatId).toBe('FR99887766554')
    expect(profile.address.street).toBe('42 Boulevard Saint-Michel')
    expect(profile.address.city).toBe('Lyon')
    expect(profile.address.postalCode).toBe('69002')
    expect(profile.formattedAddress).toBe('42 Boulevard Saint-Michel, 69002 Lyon, France')

    const billingParty = getOperatorBillingParty()
    expect(billingParty.name).toBe('Custom Artisan SAS')
    expect(billingParty.email).toBe('invoices@custom.eu')
    expect(billingParty.vatId).toBe('FR99887766554')
  })
})
