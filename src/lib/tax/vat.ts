import { EU_VAT_REGEXES, isVatIdFormatValid } from './vat-patterns'

export function validateVatId(vatId: string): { valid: boolean; message?: string } {
  const cleaned = vatId.replace(/\s/g, '').toUpperCase()
  if (cleaned.length < 3) {
    return { valid: false, message: 'VAT ID is too short' }
  }

  const prefix = cleaned.slice(0, 2)
  if (!EU_VAT_REGEXES[prefix]) {
    return { valid: false, message: 'Unrecognised country code in VAT ID' }
  }

  if (!isVatIdFormatValid(cleaned, prefix)) {
    return { valid: false, message: `Invalid format for ${prefix} VAT ID` }
  }

  return { valid: true }
}
