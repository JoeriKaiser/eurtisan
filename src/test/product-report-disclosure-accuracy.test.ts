import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '../..')

function readSource(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8')
}

describe('product report disclosure accuracy', () => {
  it('submits the DSA notice through a server function that inserts a row', () => {
    const detail = readSource('src/components/ProductDetail.tsx')
    expect(detail).toMatch(/reportProduct\(/)
    expect(detail).not.toMatch(/_reason/)

    const query = readSource('src/lib/products/reports.server.ts')
    const reportFn = query.slice(
      query.indexOf('export async function reportProductQuery'),
      query.indexOf('export async function listOpenProductReportsQuery'),
    )
    expect(reportFn).toMatch(/db\.insert\(productReport\)/)
    expect(reportFn).not.toMatch(/isActive:\s*false/)
  })

  it('keeps Art. 16 copy on the dialog', () => {
    const dialog = readSource('src/components/product/ReportProductDialog.tsx')
    expect(dialog).toMatch(/DSA Article 16/)
    expect(dialog).toMatch(/product_report_reason_illegal/)
  })

  it('mentions the notice channel in the terms', () => {
    const locales = (
      JSON.parse(readSource('project.inlang/settings.json')) as { locales: string[] }
    ).locales
    for (const locale of locales) {
      const messages = JSON.parse(readSource(`messages/${locale}.json`)) as Record<string, string>
      expect(messages.terms_section_16_text.toLowerCase()).toMatch(
        /article 16|artikel 16|notice|signalement/,
      )
    }
  })
})
