/**
 * Minimal feature-flag registry backed by environment variables.
 *
 * Enable:  FEATURE_<NAME>=1|true
 * Disable: FEATURE_<NAME>=0|false
 * Unset:   uses default from FEATURE_DEFAULTS
 */

const FEATURE_DEFAULTS: Record<string, boolean> = {
  MOCK_PAYMENTS: process.env.MOCK_PAYMENTS_ENABLED === 'true',
}

function envKeyFor(flag: string): string {
  return `FEATURE_${flag.replace(/-/g, '_').toUpperCase()}`
}

/** Returns whether a named feature flag is enabled. */
export function isFeatureEnabled(flag: keyof typeof FEATURE_DEFAULTS | string): boolean {
  const key = envKeyFor(flag)
  const raw = process.env[key]
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  return FEATURE_DEFAULTS[flag] ?? false
}

/** All known flags and their effective state (for ops/debug). */
export function listFeatureFlags(): Record<string, boolean> {
  const names = new Set([...Object.keys(FEATURE_DEFAULTS)])
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('FEATURE_')) {
      names.add(key.slice('FEATURE_'.length).toLowerCase())
    }
  }
  const out: Record<string, boolean> = {}
  for (const name of names) {
    out[name] = isFeatureEnabled(name)
  }
  return out
}
