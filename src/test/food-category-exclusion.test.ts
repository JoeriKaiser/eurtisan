import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isEuLocale } from '#/lib/i18n/eu-locales'
import { CATEGORY_DESCRIPTIONS, SUBCATEGORY_DESCRIPTIONS } from '../db/seed-descriptions.ts'

/**
 * Eurtisan does not sell food. Terms say so. The product model has none of the
 * Regulation (EU) 1169/2011 Art. 14 fields a listing would need before purchase.
 * A seed or megamenu that recreates Food & Drink after migration 0081 would put
 * that category back in front of buyers.
 */

const REPO_ROOT = join(import.meta.dirname, '../..')

const FOOD_NAME = /food\s*&\s*drink|food-drink/i
const FOOD_SUBS = /Food & Drink-(?:Preserves|Honey|Spices)/

describe('food category exclusion', () => {
  it('does not seed a Food & Drink category', () => {
    const staging = readFileSync(join(REPO_ROOT, 'src/db/seed-staging.ts'), 'utf8')
    const local = readFileSync(join(REPO_ROOT, 'src/db/seed.ts'), 'utf8')
    expect(staging).not.toMatch(FOOD_NAME)
    expect(local).not.toMatch(FOOD_NAME)
    expect(Object.keys(CATEGORY_DESCRIPTIONS).join('\n')).not.toMatch(FOOD_NAME)
    expect(Object.keys(SUBCATEGORY_DESCRIPTIONS).join('\n')).not.toMatch(FOOD_SUBS)
  })

  it('does not map a food-drink megamenu icon', () => {
    const megamenu = readFileSync(join(REPO_ROOT, 'src/components/CategoriesMegamenu.tsx'), 'utf8')
    expect(megamenu).not.toMatch(/food-drink/)
  })

  it('keeps the no-food terms sentence in every locale file', () => {
    const rawSettings = readFileSync(join(REPO_ROOT, 'project.inlang/settings.json'), 'utf8')
    const parsedSettings: unknown = JSON.parse(rawSettings)
    const locales =
      parsedSettings &&
      typeof parsedSettings === 'object' &&
      'locales' in parsedSettings &&
      Array.isArray(parsedSettings.locales)
        ? (parsedSettings.locales as string[])
        : []
    for (const locale of locales) {
      if (!isEuLocale(locale)) continue
      const rawMessages = readFileSync(join(REPO_ROOT, `messages/${locale}.json`), 'utf8')
      const messages: Record<string, string> = JSON.parse(rawMessages)
      expect(messages.terms_section_11_text).toContain('1169/2011')
      expect(messages.terms_section_11_text.trim().length).toBeGreaterThan(0)
    }
  })
})
