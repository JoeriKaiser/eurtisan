import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Coffee,
  Flower2,
  Gem,
  Hammer,
  Lightbulb,
  Music,
  Palette,
  Scissors,
  Shirt,
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  art: Palette,
  fashion: Shirt,
  food: Coffee,
  jewellery: Gem,
  jewelry: Gem,
  music: Music,
  books: BookOpen,
  textiles: Scissors,
  botanical: Flower2,
  woodwork: Hammer,
  ceramics: Lightbulb,
}

const CATEGORY_ICON_ENTRIES = Object.entries(CATEGORY_ICONS)

export function getCategoryIcon(name: string): LucideIcon {
  const key = name.toLowerCase()
  // Intentionally sequential: substring matching requires iterating all entries.
  for (const [slug, Icon] of CATEGORY_ICON_ENTRIES) {
    if (key.indexOf(slug) !== -1) return Icon as LucideIcon
  }
  return Palette
}
