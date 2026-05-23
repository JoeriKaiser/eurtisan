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

export function getCategoryIcon(name: string): LucideIcon {
  const key = name.toLowerCase()
  for (const [slug, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(slug)) return Icon as LucideIcon
  }
  return Palette
}
