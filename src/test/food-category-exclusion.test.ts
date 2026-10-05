import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
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

function readSource(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8')
}

describe('food category exclusion', () => {
  it('does not seed a Food & Drink category', () => {
    const staging = readSource('src/db/seed-staging.ts')
    const local = readSource('src/db/seed.ts')
    expect(staging).not.toMatch(FOOD_NAME)
    expect(local).not.toMatch(FOOD_NAME)
    expect(Object.keys(CATEGORY_DESCRIPTIONS).join('\n')).not.toMatch(FOOD_NAME)
    expect(Object.keys(SUBCATEGORY_DESCRIPTIONS).join('\n')).not.toMatch(FOOD_SUBS)
  })

  it('does not map a food-drink megamenu icon', () => {
    const megamenu = readSource('src/components/CategoriesMegamenu.tsx')
    expect(megamenu).not.toMatch(/food-drink/)
  })

  it('keeps the no-food terms sentence in every locale file', () => {
    const locales = (
      JSON.parse(readSource('project.inlang/settings.json')) as { locales: string[] }
    ).locales
    for (const locale of locales) {
      const messages = JSON.parse(readSource(`messages/${locale}.json`)) as Record<string, string>
      expect(messages.terms_section_11_text).toMatch(/food|voedsel|aliment/i)
      expect(messages.terms_section_11_text).toMatch(
        /1169\/2011|allergen|allergène|ingredient|ingrediënt|ingrédient/i,
      )
    }
  })
})
