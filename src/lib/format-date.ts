import { getLocale } from '#/paraglide/runtime'

function coerceDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

/** e.g. "May 31, 2026" */
export function formatDateLong(value: Date | string | number): string {
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(coerceDate(value))
}

/** e.g. "May 31, 2026" (short month) */
export function formatDateShort(value: Date | string | number): string {
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(coerceDate(value))
}

/** e.g. "May 31, 2026, 4:30 PM" */
export function formatDateMediumTime(value: Date | string | number): string {
  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(coerceDate(value))
}

/** e.g. "May 31, 2026" */
export function formatDateMedium(value: Date | string | number): string {
  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: 'medium',
  }).format(coerceDate(value))
}

/** e.g. "May 31, 2026, 04:30 PM" (long month + time) */
export function formatDateLongWithTime(value: Date | string | number): string {
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(coerceDate(value))
}
