import { Link } from '@tanstack/react-router'
import { Badge } from './ui/badge'

interface ProductCardProps {
  id: string
  name: string
  shopId: string
  shopName: string
  price: string
  description: string | null
  categoryName: string | null
}

export default function ProductCard({
  name,
  shopId,
  shopName,
  price,
  description,
  categoryName,
}: ProductCardProps) {
  return (
    <article className='group flex flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-default shadow-sm transition-all duration-fast ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong'>
      {/* Image area — warm placeholder, shorter ratio */}
      <Link
        to='/studio/$shopId'
        params={{ shopId }}
        className='relative block aspect-[3/2] overflow-hidden no-underline'
      >
        {/* Warm gradient placeholder instead of gray */}
        <div
          className='h-full w-full transition-transform duration-slow ease-out group-hover:scale-[1.03]'
          style={{
            background:
              'linear-gradient(135deg, oklch(93% 0.02 75) 0%, oklch(90% 0.03 145) 50%, oklch(88% 0.04 175) 100%)',
          }}
        />
        {/* Subtle texture overlay */}
        <div
          className='pointer-events-none absolute inset-0 opacity-40'
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 10px, oklch(100% 0 0 / 0.06) 10px, oklch(100% 0 0 / 0.06) 20px)',
          }}
        />
        {/* Hover tint */}
        <div className='absolute inset-0 bg-accent-primary/0 transition-colors duration-fast group-hover:bg-accent-primary/5' />
      </Link>

      <div className='flex flex-1 flex-col p-4'>
        <h3 className='mb-1 text-sm font-semibold leading-snug text-text-primary'>
          <Link to='/studio/$shopId' params={{ shopId }} className='no-underline hover:underline'>
            {name}
          </Link>
        </h3>

        <p className='mb-3 line-clamp-2 text-xs text-text-secondary'>
          {description ?? 'Handcrafted with care'}
        </p>

        <div className='mt-auto flex items-center justify-between gap-2'>
          <span className='text-sm font-bold tabular-nums text-text-primary'>{price}</span>
          {categoryName && (
            <Badge variant='default' className='text-[10px]'>
              {categoryName}
            </Badge>
          )}
        </div>

        <p className='mt-2 text-xs text-text-muted'>
          by{' '}
          <Link
            to='/studio/$shopId'
            params={{ shopId }}
            className='font-medium text-text-secondary no-underline hover:text-text-primary hover:underline'
          >
            {shopName}
          </Link>
        </p>
      </div>
    </article>
  )
}
