/**
 * English/Dutch synonym groups for the products index.
 *
 * Eurtisan serves `en` and `nl`, but listings are written in whichever language
 * the seller chose. Without synonyms a Dutch buyer searching "mok" never finds
 * a listing titled "Ceramic Mug", and vice versa. Meilisearch synonyms are
 * one-directional, so every term in a group is expanded to the others.
 *
 * Keep groups small and unambiguous: a synonym that is only sometimes correct
 * damages precision across every query that touches it.
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // Materials
  ['ceramic', 'ceramics', 'keramiek', 'keramisch'],
  ['pottery', 'aardewerk'],
  ['porcelain', 'porselein'],
  ['wood', 'wooden', 'hout', 'houten'],
  ['glass', 'glas'],
  ['leather', 'leer', 'leren'],
  ['wool', 'wol', 'wollen'],
  ['cotton', 'katoen', 'katoenen'],
  ['linen', 'linnen'],
  ['silver', 'zilver', 'zilveren'],
  ['gold', 'golden', 'goud', 'gouden'],
  ['brass', 'messing'],
  ['stone', 'steen', 'stenen'],

  // Tableware and kitchen
  ['mug', 'mugs', 'mok', 'mokken'],
  ['cup', 'kopje', 'kopjes'],
  ['bowl', 'bowls', 'kom', 'kommen', 'schaal'],
  ['plate', 'plates', 'bord', 'borden'],
  ['vase', 'vases', 'vaas', 'vazen'],
  ['teapot', 'theepot'],
  ['cutting board', 'snijplank'],

  // Jewellery
  ['jewelry', 'jewellery', 'sieraden'],
  ['earrings', 'earring', 'oorbellen'],
  ['necklace', 'ketting', 'halsketting'],
  ['bracelet', 'armband'],
  ['ring', 'ringen'],
  ['brooch', 'broche'],

  // Textiles and apparel
  ['scarf', 'scarves', 'sjaal', 'sjaals'],
  ['blanket', 'deken', 'plaid'],
  ['pillow', 'cushion', 'kussen'],
  ['towel', 'handdoek'],
  ['napkin', 'napkins', 'servet', 'servetten'],
  ['bag', 'tas', 'tassen'],
  ['wallet', 'portemonnee'],
  ['hat', 'muts', 'hoed'],
  ['gloves', 'handschoenen'],
  ['socks', 'sokken'],

  // Home
  ['candle', 'candles', 'kaars', 'kaarsen'],
  ['candlestick', 'kandelaar'],
  ['lamp', 'lamps', 'lampen'],
  ['soap', 'zeep'],
  ['basket', 'mand', 'manden'],
  ['mirror', 'spiegel'],
  ['clock', 'klok'],
  ['poster', 'print', 'prent'],
  ['painting', 'schilderij'],

  // Descriptors
  ['handmade', 'hand made', 'handgemaakt'],
  ['vintage', 'retro'],
  ['gift', 'cadeau', 'geschenk'],
  ['kids', 'children', 'kinderen', 'kinder'],
  ['small', 'klein'],
  ['large', 'big', 'groot'],
]

/**
 * Expand groups into the one-directional map Meilisearch expects: every term
 * maps to the other members of its group.
 */
export function buildSynonyms(
  groups: readonly (readonly string[])[] = SYNONYM_GROUPS,
): Record<string, string[]> {
  const synonyms: Record<string, string[]> = {}

  for (const group of groups) {
    for (const term of group) {
      const others = group.filter((other) => other !== term)
      if (others.length === 0) continue
      // A term may legitimately appear in more than one group.
      synonyms[term] = [...new Set([...(synonyms[term] ?? []), ...others])]
    }
  }

  return synonyms
}

export const PRODUCT_SYNONYMS = buildSynonyms()
