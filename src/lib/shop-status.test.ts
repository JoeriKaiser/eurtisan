import { describe, expect, it } from 'vitest'
import { isValidShopStatusTransition } from './shop-status'

describe('isValidShopStatusTransition', () => {
  it('allows draft -> pending_review', () => {
    expect(isValidShopStatusTransition('draft', 'pending_review')).toBe(true)
  })

  it('allows pending_review -> approved', () => {
    expect(isValidShopStatusTransition('pending_review', 'approved')).toBe(true)
  })

  it('allows active -> paused', () => {
    expect(isValidShopStatusTransition('active', 'paused')).toBe(true)
  })

  it('allows paused -> active', () => {
    expect(isValidShopStatusTransition('paused', 'active')).toBe(true)
  })

  it('allows active -> archived', () => {
    expect(isValidShopStatusTransition('active', 'archived')).toBe(true)
  })

  it('disallows pending_review -> active', () => {
    expect(isValidShopStatusTransition('pending_review', 'active')).toBe(false)
  })

  it('disallows archived -> active', () => {
    expect(isValidShopStatusTransition('archived', 'active')).toBe(false)
  })

  it('disallows rejected -> pending_review', () => {
    expect(isValidShopStatusTransition('rejected', 'pending_review')).toBe(false)
  })
})
