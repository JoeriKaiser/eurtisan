import { describe, expect, it } from 'vitest'
import { isPostgresUniqueViolation, PG_UNIQUE_VIOLATION } from './db-errors'

describe('isPostgresUniqueViolation', () => {
  it('returns true for 23505 on the error or cause chain', () => {
    expect(isPostgresUniqueViolation({ code: PG_UNIQUE_VIOLATION })).toBe(true)
    expect(
      isPostgresUniqueViolation({
        cause: { code: PG_UNIQUE_VIOLATION, constraint: 'shop_slug_unique' },
      }),
    ).toBe(true)
  })

  it('matches constraint name when provided', () => {
    expect(
      isPostgresUniqueViolation(
        { code: PG_UNIQUE_VIOLATION, constraint: 'product_shop_slug_unique' },
        'product_shop_slug_unique',
      ),
    ).toBe(true)
    expect(
      isPostgresUniqueViolation(
        { code: PG_UNIQUE_VIOLATION, constraint: 'shop_slug_unique' },
        'product_shop_slug_unique',
      ),
    ).toBe(false)
  })

  it('returns false for other errors', () => {
    expect(isPostgresUniqueViolation({ code: '23503' })).toBe(false)
    expect(isPostgresUniqueViolation(null)).toBe(false)
  })
})
