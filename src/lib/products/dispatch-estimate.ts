/**
 * Computes business-day date offsets excluding Saturdays and Sundays.
 */
export function addBusinessDays(startDate: Date, businessDays: number): Date {
  const result = new Date(startDate.getTime())
  let added = 0
  const count = Math.max(0, Math.floor(businessDays))
  while (added < count) {
    result.setDate(result.getDate() + 1)
    const day = result.getDay()
    // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) {
      added++
    }
  }
  return result
}

/**
 * Formats a localized calendar date range for an estimated dispatch window.
 */
export function formatDispatchDateWindow(
  minDays: number,
  maxDays: number,
  fromDate: Date = new Date(),
  locale = 'en-GB',
): string {
  const safeMin = Math.max(0, Math.floor(minDays))
  const safeMax = Math.max(safeMin, Math.floor(maxDays))

  const start = addBusinessDays(fromDate, safeMin)
  const end = addBusinessDays(fromDate, safeMax)

  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  })

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return formatter.format(start)
  }

  return `${formatter.format(start)} – ${formatter.format(end)}`
}
