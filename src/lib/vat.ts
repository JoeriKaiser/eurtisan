const VAT_ID_PATTERNS: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE(0?\d{9}|\d{10})$/,
  BG: /^BG\d{9,10}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  EL: /^EL\d{9}$/, // Greece (VIES prefix)
  ES: /^ES([A-Z]\d{7}[A-Z]|\d{8}[A-Z]|[A-Z]\d{8})$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-Z]{2}\d{9}$/,
  GR: /^GR\d{9}$/, // Greece (ISO prefix, accepted for convenience)
  HR: /^HR\d{11}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE\d{7}[A-Z]{1,2}$/,
  IT: /^IT\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SE: /^SE\d{10}01$/,
  SI: /^SI\d{8}$/,
  SK: /^SK\d{10}$/,
}

export function validateVatId(vatId: string): { valid: boolean; message?: string } {
  const cleaned = vatId.replace(/\s/g, '').toUpperCase()
  if (cleaned.length < 3) {
    return { valid: false, message: 'VAT ID is too short' }
  }

  const prefix = cleaned.slice(0, 2)
  const pattern = VAT_ID_PATTERNS[prefix]
  if (!pattern) {
    return { valid: false, message: 'Unrecognised country code in VAT ID' }
  }

  if (!pattern.test(cleaned)) {
    return { valid: false, message: `Invalid format for ${prefix} VAT ID` }
  }

  return { valid: true }
}
