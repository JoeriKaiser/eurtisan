import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'

interface ViewTabsProps {
  isModerationView: boolean
  onViewChange: (view: 'moderation' | 'applications') => void
}

export function ViewTabs({ isModerationView, onViewChange }: ViewTabsProps) {
  return (
    <div className='border-b border-border-default pb-px flex gap-6' role='tablist'>
      <button
        type='button'
        role='tab'
        aria-selected={isModerationView}
        onClick={() => onViewChange('moderation')}
        className={cn(
          'border-b-2 pb-3 text-sm font-semibold transition-colors focus-visible:outline-none cursor-pointer',
          isModerationView
            ? 'border-accent-primary text-text-primary'
            : 'border-transparent text-text-secondary hover:text-text-primary',
        )}
      >
        {m.admin_shops_view_moderation()}
      </button>
      <button
        type='button'
        role='tab'
        aria-selected={!isModerationView}
        onClick={() => onViewChange('applications')}
        className={cn(
          'border-b-2 pb-3 text-sm font-semibold transition-colors focus-visible:outline-none cursor-pointer',
          !isModerationView
            ? 'border-accent-primary text-text-primary'
            : 'border-transparent text-text-secondary hover:text-text-primary',
        )}
      >
        {m.admin_shops_view_applications()}
      </button>
    </div>
  )
}
