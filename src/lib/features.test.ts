import { afterEach, describe, expect, it } from 'vitest'
import { isFeatureEnabled, listFeatureFlags } from './features'

describe('isFeatureEnabled', () => {
  afterEach(() => {
    delete process.env.FEATURE_TEST_FLAG
  })

  it('reads explicit env overrides', () => {
    process.env.FEATURE_TEST_FLAG = 'true'
    expect(isFeatureEnabled('test_flag')).toBe(true)
    process.env.FEATURE_TEST_FLAG = 'false'
    expect(isFeatureEnabled('test_flag')).toBe(false)
  })

  it('lists known flags', () => {
    const flags = listFeatureFlags()
    expect(typeof flags.MOCK_PAYMENTS).toBe('boolean')
  })
})
