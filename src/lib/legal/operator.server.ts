import '@tanstack/react-start/server-only'

import {
  getOperatorBillingEmail,
  getOperatorCity,
  getOperatorCountry,
  getOperatorLegalEmail,
  getOperatorLegalName,
  getOperatorPostalCode,
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
