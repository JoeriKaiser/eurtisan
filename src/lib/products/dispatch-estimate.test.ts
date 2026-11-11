import { describe, expect, it } from 'vitest'
import { addBusinessDays, formatDispatchDateWindow } from './dispatch-estimate'

describe('addBusinessDays', () => {
  it('adds business days within the same week', () => {
    // Wednesday Nov 11 2026
    const wed = new Date(2026, 10, 11)
    const fri = addBusinessDays(wed, 2)
    expect(fri.getFullYear()).toBe(2026)
    expect(fri.getMonth()).toBe(10)
    expect(fri.getDate()).toBe(13)
  })

  it('skips weekends when adding business days across a weekend', () => {
    // Thursday Nov 12 2026
    const thu = new Date(2026, 10, 12)
    // 2 business days: Friday Nov 13 (1), Monday Nov 16 (2)
    const mon = addBusinessDays(thu, 2)
    expect(mon.getDate()).toBe(16)
    expect(mon.getDay()).toBe(1) // Monday
  })

  it('handles orders placed on a weekend correctly', () => {
    // Saturday Nov 14 2026
    const sat = new Date(2026, 10, 14)
    // 1 business day: Monday Nov 16
    const mon = addBusinessDays(sat, 1)
    expect(mon.getDate()).toBe(16)
    expect(mon.getDay()).toBe(1)
  })

  it('returns same date for 0 business days', () => {
    const wed = new Date(2026, 10, 11)
    const same = addBusinessDays(wed, 0)
    expect(same.getDate()).toBe(11)
  })
})

describe('formatDispatchDateWindow', () => {
  it('formats a date range across business days', () => {
    // Wednesday Nov 11 2026
    const wed = new Date(2026, 10, 11)
    const result = formatDispatchDateWindow(2, 5, wed, 'en-GB')
    // 2 days -> Fri 13 Nov, 5 days -> Wed 18 Nov
    expect(result).toBe('13 Nov – 18 Nov')
  })

  it('formats single date when min and max are identical', () => {
    const wed = new Date(2026, 10, 11)
    const result = formatDispatchDateWindow(2, 2, wed, 'en-GB')
    expect(result).toBe('13 Nov')
  })
})
