import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('shop processing time migrations', () => {
  it('does not stamp default dispatch windows in 0088', () => {
    const sql = readFileSync('drizzle/0088_neat_galactus.sql', 'utf8')
    expect(sql).not.toMatch(/processing_time_min_days"\s*=\s*2/)
    expect(sql).not.toMatch(/processing_time_max_days"\s*=\s*5/)
    expect(sql).not.toMatch(/ships_international"\s*=\s*true/)
  })

  it('clears denormalized processing times in 0089', () => {
    const sql = readFileSync('drizzle/0089_clear_stamped_processing_times.sql', 'utf8')
    expect(sql).toMatch(/processing_time_min_days"\s*=\s*NULL/)
    expect(sql).toMatch(/processing_time_max_days"\s*=\s*NULL/)
  })
})
