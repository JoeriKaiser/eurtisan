import { describe, expect, it } from 'vitest'
import { getPresignedUploadUrl } from './upload'

describe('getPresignedUploadUrl', () => {
  it('is exported as a server function', () => {
    expect(getPresignedUploadUrl).toBeDefined()
    expect(typeof getPresignedUploadUrl).toBe('function')
  })
})
