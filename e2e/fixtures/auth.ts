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
