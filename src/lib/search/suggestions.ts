/**
 * Pure construction of the search overlay's suggestion list.
 *
 * Kept free of data fetching so the ordering and de-duplication rules are
 * directly testable — they are easy to break and hard to notice.
 */

export type SuggestionType = 'query' | 'product' | 'category'

export interface SearchSuggestion {
  type: SuggestionType
  label: string
  href?: string
  slug?: string
}

export interface SuggestionProduct {
  name: string
  slug: string
  shopSlug: string | null
}

export interface SuggestionCategory {
  slug: string
  name: string
}

const MAX_SUGGESTIONS = 8
const MAX_CATEGORY_SUGGESTIONS = 2

/**
 * Build the suggestion list shown under the search input.
 *
 * The raw query always leads, so pressing Enter immediately is predictable;
 * product matches follow, then a couple of category shortcuts. Labels are
 * de-duplicated case-insensitively so a product named exactly like the query
 * does not appear twice.
 */
export function buildSuggestions(
  query: string,
  products: readonly SuggestionProduct[],
  categories: readonly SuggestionCategory[] = [],
): SearchSuggestion[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const suggestions: SearchSuggestion[] = [{ type: 'query', label: trimmed }]
  const seen = new Set<string>([trimmed.toLowerCase()])

  for (const product of products) {
    if (!product.name || !product.slug) continue
    const key = product.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    suggestions.push({
      type: 'product',
      label: product.name,
      href: `/shops/${product.shopSlug ?? 'unknown'}/products/${product.slug}`,
      slug: product.slug,
    })
  }

  let categoryCount = 0
  for (const category of categories) {
    if (categoryCount >= MAX_CATEGORY_SUGGESTIONS) break
    if (!category.slug) continue
    const label = category.name || humanizeSlug(category.slug)
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    suggestions.push({ type: 'category', label, href: `/category/${category.slug}` })
    categoryCount++
  }

  return suggestions.slice(0, MAX_SUGGESTIONS)
}

/** Fallback display name when a category facet has no resolved name. */
export function humanizeSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
