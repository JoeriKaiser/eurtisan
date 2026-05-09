import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  Coffee,
  Flower2,
  Gem,
  Hammer,
  Lightbulb,
  type LucideIcon,
  Music,
  Palette,
  Scissors,
  Shirt,
} from 'lucide-react'

// Artisans don't use generic grid cards with icons as decoration.
// But for category discovery on a marketplace, a visual shorthand
// helps buyers browse. We keep it restrained: one icon, one name,
// no superfluous description text.

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

function getCategoryIcon(name: string): LucideIcon {
  const key = name.toLowerCase()
  for (const [slug, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(slug)) return Icon as LucideIcon
  }
  return Palette
}

interface CategoryCardProps {
  id: string
  name: string
  slug: string
  description?: string | null
  productCount?: number
}

export default function CategoryCard({ name, slug, description, productCount }: CategoryCardProps) {
  const Icon = getCategoryIcon(name)

  return (
    <Link
      to='/category/$slug'
      params={{ slug }}
      className='group flex items-center gap-4 rounded-2xl border border-border-default bg-surface-default p-5 shadow-sm transition-all duration-fast ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md no-underline'
    >
      <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-primary-subtle text-accent-primary transition-colors duration-fast group-hover:bg-accent-primary group-hover:text-text-on-primary'>
        <Icon size={22} strokeWidth={1.5} />
      </div>
      <div className='min-w-0'>
        <h3 className='text-sm font-semibold text-text-primary'>{name}</h3>
        {description ? (
          <p className='truncate text-xs text-text-muted'>{description}</p>
        ) : (
          <p className='text-xs text-text-muted'>
            {productCount !== undefined
              ? `${productCount} ${productCount === 1 ? 'product' : 'products'}`
              : 'Browse collection'}
          </p>
        )}
      </div>
    </Link>
  )
}
