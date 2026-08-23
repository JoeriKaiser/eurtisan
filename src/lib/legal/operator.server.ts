import '@tanstack/react-start/server-only'

import {
  getHostingProviderAddress,
  getHostingProviderName,
  getHostingProviderPhone,
  getOperatorBillingEmail,
  getOperatorCity,
  getOperatorCountry,
  getOperatorLegalEmail,
  getOperatorLegalForm,
  getOperatorLegalName,
  getOperatorPostalCode,
  getOperatorPublicationDirector,
  getOperatorRcsCity,
  getOperatorShareCapital,
  getOperatorSiren,
  getOperatorSiret,
  getOperatorStreet,
  getOperatorVatId,
} from '#/lib/infra/env.server'
import type { BillingParty } from '#/lib/invoices/types'

export interface OperatorLegalProfile {
  name: string
  email: string
  billingEmail: string
  vatId: string
  address: {
    street: string
    city: string
    postalCode: string
    country: string
  }
  formattedAddress: string
  /** French legal form (e.g. 'SAS'). Unset when not configured. */
  legalForm: string | undefined
  /** Declared share capital. Optional even in production. */
  shareCapital: string | undefined
  /** SIREN identifier (9 digits). Unset when not configured. */
  siren: string | undefined
  /** SIRET identifier (14 digits). Unset when not configured. */
  siret: string | undefined
  /** City of RCS registration. Unset when not configured. */
  rcsCity: string | undefined
  /** Publication director named on the imprint. Unset when not configured. */
  publicationDirector: string | undefined
  /** Hosting provider details required by LCEN Art. 6-III 2°. */
  hosting:
    | {
        name: string
        address: string | undefined
        phone: string | undefined
      }
    | undefined
}

/**
 * Returns the legal profile of the platform operator.
 * Values are loaded dynamically from environment variables, falling back to
 * safe default configuration if unset.
 */
export function getOperatorProfile(): OperatorLegalProfile {
  const name = getOperatorLegalName()
  const email = getOperatorLegalEmail()
  const billingEmail = getOperatorBillingEmail()
  const vatId = getOperatorVatId()
  const street = getOperatorStreet()
  const city = getOperatorCity()
  const postalCode = getOperatorPostalCode()
  const country = getOperatorCountry()

  const legalForm = getOperatorLegalForm()
  const shareCapital = getOperatorShareCapital()
  const siren = getOperatorSiren()
  const siret = getOperatorSiret()
  const rcsCity = getOperatorRcsCity()
  const publicationDirector = getOperatorPublicationDirector()
  const hostingName = getHostingProviderName()
  const hostingAddress = getHostingProviderAddress()
  const hostingPhone = getHostingProviderPhone()

  const countryDisplay = country === 'FR' ? 'France' : country
  const formattedAddress = `${street}, ${postalCode} ${city}, ${countryDisplay}`

  return {
    name,
    email,
    billingEmail,
    vatId,
    address: {
      street,
      city,
      postalCode,
      country,
    },
    formattedAddress,
    legalForm,
    shareCapital,
    siren,
    siret,
    rcsCity,
    publicationDirector,
    hosting: hostingName
      ? { name: hostingName, address: hostingAddress, phone: hostingPhone }
      : undefined,
  }
}

/**
 * Returns the platform billing party used as the issuer (`from`) on
 * platform fee commission invoices.
 */
export function getOperatorBillingParty(): BillingParty {
  const profile = getOperatorProfile()
  return {
    name: profile.name,
    email: profile.billingEmail,
    vatId: profile.vatId,
    address: {
      street: profile.address.street,
      city: profile.address.city,
      postalCode: profile.address.postalCode,
      country: profile.address.country,
    },
  }
}
