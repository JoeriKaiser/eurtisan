/**
 * Escapes a CSV cell value.
 * If the value contains commas, quotes, or newlines, wraps it in quotes
 * and escapes existing quotes by doubling them.
 */
function escapeCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Generates a CSV string from rows and headers.
 *
 * @param rows Array of row objects.
 * @param columns Array of { key, label } defining column order and headers.
 * @returns CSV content as a string.
 */
export function generateCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{ key: keyof T; label: string }>,
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',')
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = row[c.key]
        const str = raw == null ? '' : String(raw)
        return escapeCell(str)
      })
      .join(','),
  )
  return [header, ...lines].join('\n')
}

/**
 * Triggers a browser download of a CSV file.
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
