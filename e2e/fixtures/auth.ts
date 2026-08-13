import { readFileSync } from 'node:fs'

/** Shared E2E credentials — must match `src/db/seed.ts`. */
export const E2E_CREATOR = {
  email: 'creator@eurtisan.local',
  password: 'creator',
  displayName: 'Eurtisan Creator',
} as const

export const E2E_ADMIN = {
  email: 'admin@eurtisan.local',
  password: 'admin',
} as const

export const E2E_CUSTOMER = {
  email: 'customer@eurtisan.local',
  password: 'customer',
  displayName: 'Customer User',
} as const

/**
 * Playwright storage-state cookie shape. Exported so setup files can reuse
 * existing auth state instead of re-authenticating through the API every run.
 */
export interface StorageStateCookie {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

/**
 * Load cookies from a previously saved Playwright storage state file.
 * Returns an empty array if the file cannot be read or contains no cookies.
 */
export function loadAuthCookies(path: string): StorageStateCookie[] {
  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as { cookies?: StorageStateCookie[] }
    return parsed.cookies ?? []
  } catch {
    return []
  }
}
