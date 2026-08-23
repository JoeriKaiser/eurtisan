// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ImprintPage from './ImprintPage'
import type { PublicOperatorProfile } from '#/lib/legal/operator'

vi.mock('#/paraglide/messages', () => ({
  m: {
    imprint_title: () => 'Legal Notice',
    imprint_kicker: () => 'Statutory Information',
    imprint_publisher_title: () => 'Publisher',
    imprint_publishing_director_title: () => 'Publishing Director',
    imprint_hosting_title: () => 'Hosting Provider',
    imprint_field_legal_form: () => 'Legal form',
    imprint_field_share_capital: () => 'Share capital',
    imprint_field_siren: () => 'SIREN',
    imprint_field_siret: () => 'SIRET',
    imprint_field_rcs_city: () => 'RCS registration city',
    imprint_field_vat_id: () => 'VAT number',
    imprint_field_email: () => 'Contact email',
    imprint_field_address: () => 'Registered office',
    imprint_field_host_address: () => 'Address',
    imprint_field_host_phone: () => 'Phone',
    imprint_pending_configuration: () =>
      'Some registration identifiers are not configured yet and will be published here once available.',
    legal_operator_name: () => 'Eurtisan',
    legal_operator_address: () => '1 Place de la République, 75001 Paris, France',
    legal_contact_email: () => 'legal@eurtisan.eu',
    legal_vat_number: () => 'FR00000000000',
  },
}))

const populatedOperator: PublicOperatorProfile = {
  name: 'Eurtisan Platform',
  email: 'legal@eurtisan.eu',
  vatId: 'FR00000000000',
  formattedAddress: '1 Place de la République, 75001 Paris, France',
  legalForm: 'SAS',
  shareCapital: '10 000 euros',
  siren: '123456789',
  siret: '12345678901234',
  rcsCity: 'Paris',
  publicationDirector: 'Jane Doe',
  hosting: {
    name: 'Example VPS Provider',
    address: '2 Rue des Exemples, 75002 Paris',
    phone: '+33 1 00 00 00 00',
  },
}

describe('ImprintPage', () => {
  it('renders every LCEN-required identifier when the profile is populated', () => {
    render(<ImprintPage operator={populatedOperator} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Legal Notice' })).toBeDefined()
    expect(screen.getByText('Eurtisan Platform')).toBeDefined()
    expect(screen.getByText('Jane Doe')).toBeDefined()
    expect(screen.getByText('Example VPS Provider')).toBeDefined()
    expect(screen.getByText('2 Rue des Exemples, 75002 Paris')).toBeDefined()
    expect(screen.getByText('+33 1 00 00 00 00')).toBeDefined()
    for (const label of [
      'Legal form',
      'Share capital',
      'SIREN',
      'SIRET',
      'RCS registration city',
      'VAT number',
      'Registered office',
      'Contact email',
    ]) {
      expect(screen.getByText(label)).toBeDefined()
    }
    expect(screen.queryByText(/not configured yet/)).toBeNull()
  })

  it('renders core identity and a pending notice when LCEN identifiers are unconfigured', () => {
    render(<ImprintPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Legal Notice' })).toBeDefined()
    expect(screen.getByText('Eurtisan')).toBeDefined()
    expect(screen.getByText('legal@eurtisan.eu')).toBeDefined()
    expect(screen.getByText(/not configured yet/)).toBeDefined()
    expect(screen.queryByText('Publishing Director')).toBeNull()
    expect(screen.queryByText('Hosting Provider')).toBeNull()
    expect(screen.queryByText('Jane Doe')).toBeNull()
  })
})
