import { Menu } from '@base-ui-components/react/menu'
import { Link, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import { useState } from 'react'
import {
  ChevronDown,
  Layers,
  Scissors,
  Trees,
  Sparkles,
  Palette,
  Flower2,
  Bookmark,
  Flame,
  Table,
  GlassWater,
  Hammer,
  Wind,
  Coffee,
  Music,
  FileText,
  ArrowRight,
} from 'lucide-react'
import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'
import type { CategoryTreeNode } from '#/lib/categories'

// Icon mapping based on seed category names/slugs
const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ceramics: Layers,
  textiles: Scissors,
  woodwork: Trees,
  jewellery: Sparkles,
  'fine-art': Palette,
  botanical: Flower2,
  leather: Bookmark,
  glass: GlassWater,
  metalwork: Hammer,
  'paper-goods': FileText,
  candles: Flame,
  furniture: Table,
  'soap-bath': Wind,
  'food-drink': Coffee,
  'musical-instruments': Music,
}

// Spotlight showcase card data for parent categories
const SHOWCASE_DATA: Record<
  string,
  {
    image: string
    title: () => string
    description: () => string
  }
> = {
  ceramics: {
    image: '/images/megamenu/ceramics.png',
    title: () => m.megamenu_ceramics_title(),
    description: () => m.megamenu_ceramics_desc(),
  },
  textiles: {
    image: '/images/megamenu/textiles.png',
    title: () => m.megamenu_textiles_title(),
    description: () => m.megamenu_textiles_desc(),
  },
  woodwork: {
    image: '/images/megamenu/woodwork.png',
    title: () => m.megamenu_woodwork_title(),
    description: () => m.megamenu_woodwork_desc(),
  },
}

interface CategoriesMegamenuProps {
  categories: CategoryTreeNode[]
}

export default function CategoriesMegamenu({ categories }: CategoriesMegamenuProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryTreeNode | null>(null)

  // Default to the first category when the menu is opened
  React.useEffect(() => {
    if (isOpen && categories.length > 0) {
      setActiveCategory(categories[0])
    }
  }, [isOpen, categories])

  const handleParentHover = (cat: CategoryTreeNode) => {
    setActiveCategory(cat)
  }

  const handleNavigate = (to: string) => {
    setIsOpen(false)
    void router.navigate({ to })
  }

  const spotlight = activeCategory
    ? SHOWCASE_DATA[activeCategory.slug] || {
        image: '/images/megamenu/ceramics.png',
        title: () => m.megamenu_default_title(),
        description: () => m.megamenu_default_desc(),
      }
    : null

  return (
    <>
      {isOpen && (
        <button
          type='button'
          tabIndex={-1}
          className='fixed inset-0 top-[57px] z-overlay bg-black/15 backdrop-blur-xs transition-opacity duration-fast cursor-default border-none outline-none'
          onClick={() => setIsOpen(false)}
          aria-hidden='true'
        />
      )}

      <Menu.Root open={isOpen} onOpenChange={setIsOpen}>
        <Menu.Trigger
          className='nav-link inline-flex cursor-pointer items-center gap-0.5 bg-transparent outline-none group border-none py-1'
          aria-haspopup='menu'
        >
          {m.nav_categories()}
          <ChevronDown
            size={14}
            className='transition-transform duration-fast ease-out group-data-[state=open]:rotate-180'
            aria-hidden='true'
          />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className='z-sticky' sideOffset={14} align='start'>
            <Menu.Popup
              className={cn(
                'w-[820px] max-w-[calc(100vw-32px)] flex flex-row rounded-2xl border border-border-default bg-surface-default shadow-lg overflow-hidden',
                'outline-none transition-all duration-fast ease-out',
                'data-[ending-style]:opacity-0 data-[ending-style]:scale-98 data-[ending-style]:translate-y-[-4px]',
                'data-[starting-style]:opacity-0 data-[starting-style]:scale-98 data-[starting-style]:translate-y-[-4px]',
              )}
            >
              {/* Left Pane: Parent Categories List */}
              <div className='w-[240px] border-r border-border-default/60 bg-surface-default p-2 flex flex-col gap-0.5 overflow-y-auto max-h-[480px] scrollbar-thin'>
                {categories.map((cat) => {
                  const IconComp = CATEGORY_ICONS[cat.slug] || Layers
                  const isActive = activeCategory?.id === cat.id

                  return (
                    <Menu.Item
                      key={cat.id}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-fast text-text-secondary outline-none',
                        'hover:bg-bg-inset focus-visible:bg-bg-inset hover:text-text-primary focus-visible:text-text-primary',
                        isActive &&
                          'bg-bg-inset text-text-primary border-l-2 border-accent-primary pl-2.5 rounded-l-none',
                      )}
                      onMouseEnter={() => handleParentHover(cat)}
                      onClick={() => handleNavigate(`/category/${cat.slug}`)}
                    >
                      <IconComp
                        size={16}
                        className={cn('text-text-muted', isActive && 'text-accent-primary')}
                      />
                      <span className='truncate'>{cat.name}</span>
                    </Menu.Item>
                  )
                })}
              </div>

              {/* Center Pane: Subcategories Grid */}
              <div className='flex-1 bg-surface-default p-5 flex flex-col justify-between max-h-[480px] overflow-y-auto scrollbar-thin'>
                <div className='flex flex-col gap-4'>
                  <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
                    {activeCategory?.name}
                  </h3>
                  {activeCategory?.children && activeCategory.children.length > 0 ? (
                    <div className='grid grid-cols-2 gap-x-6 gap-y-2'>
                      {activeCategory.children.map((sub) => (
                        <Link
                          key={sub.id}
                          to='/category/$slug'
                          params={{ slug: sub.slug }}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            'block py-1.5 px-2 -mx-2 rounded-md text-sm font-medium text-text-secondary transition-colors duration-fast no-underline',
                            'hover:text-accent-primary hover:bg-bg-inset/40',
                          )}
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className='text-sm text-text-muted italic py-2'>
                      No subcategories available in this category.
                    </p>
                  )}
                </div>

                {activeCategory && (
                  <div className='border-t border-border-default/50 pt-4 mt-4'>
                    <button
                      type='button'
                      onClick={() => handleNavigate(`/category/${activeCategory.slug}`)}
                      className='inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:text-accent-primary-hover uppercase tracking-wider transition-colors outline-none cursor-pointer border-none bg-transparent'
                    >
                      {m.megamenu_spotlight_explore()} {activeCategory.name}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Right Pane: Spotlight Panel */}
              {spotlight && (
                <div className='w-[280px] bg-bg-inset/20 p-5 flex flex-col gap-4 max-h-[480px] border-l border-border-default/40'>
                  <h4 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
                    {m.megamenu_spotlight_title()}
                  </h4>
                  <div className='flex flex-col gap-3 group/spot border border-border-default/40 rounded-xl overflow-hidden bg-surface-default shadow-sm transition-transform duration-fast hover:scale-[1.01]'>
                    <div className='h-28 overflow-hidden relative'>
                      <img
                        src={spotlight.image}
                        alt=''
                        className='w-full h-full object-cover transition-transform duration-slow group-hover/spot:scale-103'
                      />
                    </div>
                    <div className='p-3 pt-1 flex flex-col gap-1.5'>
                      <h5 className='text-sm font-semibold text-text-primary'>
                        {spotlight.title()}
                      </h5>
                      <p className='text-xs text-text-secondary leading-relaxed'>
                        {spotlight.description()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </>
  )
}
