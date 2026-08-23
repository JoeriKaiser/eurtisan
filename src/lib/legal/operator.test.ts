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
    delete process.env.OPERATOR_LEGAL_FORM
    delete process.env.OPERATOR_SHARE_CAPITAL
    delete process.env.OPERATOR_SIREN
    delete process.env.OPERATOR_SIRET
    delete process.env.OPERATOR_RCS_CITY
    delete process.env.OPERATOR_PUBLICATION_DIRECTOR
    delete process.env.HOSTING_PROVIDER_NAME
    delete process.env.HOSTING_PROVIDER_ADDRESS
    delete process.env.HOSTING_PROVIDER_PHONE
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
    expect(profile.legalForm).toBeUndefined()
    expect(profile.shareCapital).toBeUndefined()
    expect(profile.siren).toBeUndefined()
    expect(profile.siret).toBeUndefined()
    expect(profile.rcsCity).toBeUndefined()
    expect(profile.publicationDirector).toBeUndefined()
    expect(profile.hosting).toBeUndefined()

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
    process.env.OPERATOR_LEGAL_FORM = 'SAS'
    process.env.OPERATOR_SHARE_CAPITAL = '10 000 euros'
    process.env.OPERATOR_SIREN = '123456789'
    process.env.OPERATOR_SIRET = '12345678901234'
    process.env.OPERATOR_RCS_CITY = 'Lyon'
    process.env.OPERATOR_PUBLICATION_DIRECTOR = 'Jane Doe'
    process.env.HOSTING_PROVIDER_NAME = 'Example VPS Provider'
    process.env.HOSTING_PROVIDER_ADDRESS = '2 Rue des Exemples, 75002 Paris'
    process.env.HOSTING_PROVIDER_PHONE = '+33 1 00 00 00 00'

    const profile = getOperatorProfile()
    expect(profile.name).toBe('Custom Artisan SAS')
    expect(profile.email).toBe('contact@custom.eu')
    expect(profile.billingEmail).toBe('invoices@custom.eu')
    expect(profile.vatId).toBe('FR99887766554')
    expect(profile.address.street).toBe('42 Boulevard Saint-Michel')
    expect(profile.address.city).toBe('Lyon')
    expect(profile.address.postalCode).toBe('69002')
    expect(profile.formattedAddress).toBe('42 Boulevard Saint-Michel, 69002 Lyon, France')
    expect(profile.legalForm).toBe('SAS')
    expect(profile.shareCapital).toBe('10 000 euros')
    expect(profile.siren).toBe('123456789')
    expect(profile.siret).toBe('12345678901234')
    expect(profile.rcsCity).toBe('Lyon')
    expect(profile.publicationDirector).toBe('Jane Doe')
    expect(profile.hosting).toEqual({
      name: 'Example VPS Provider',
      address: '2 Rue des Exemples, 75002 Paris',
      phone: '+33 1 00 00 00 00',
    })

    const billingParty = getOperatorBillingParty()
    expect(billingParty.name).toBe('Custom Artisan SAS')
    expect(billingParty.email).toBe('invoices@custom.eu')
    expect(billingParty.vatId).toBe('FR99887766554')
  })

  it('omits hosting details when the provider name is unset', () => {
    process.env.HOSTING_PROVIDER_ADDRESS = '2 Rue des Exemples, 75002 Paris'
    process.env.HOSTING_PROVIDER_PHONE = '+33 1 00 00 00 00'

    expect(getOperatorProfile().hosting).toBeUndefined()
  })
})
