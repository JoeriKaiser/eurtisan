import { formatDateLong } from '#/lib/format-date'

export function formatDate(date: Date): string {
  return formatDateLong(new Date(date))
}
