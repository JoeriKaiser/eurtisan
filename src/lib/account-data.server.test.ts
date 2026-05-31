import { describe, expect, it } from 'vitest'
import { exportUserData } from './account-data.server'

describe('exportUserData', () => {
  it('throws when user does not exist', async () => {
    await expect(exportUserData('nonexistent-user-id')).rejects.toThrow('USER_NOT_FOUND')
  })
})
