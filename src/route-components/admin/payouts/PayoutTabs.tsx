import { cn } from '#/lib/cn'
import { m } from '#/paraglide/messages'

type Tab = 'pending' | 'history'

interface PayoutTabsProps {
  currentTab: Tab
  onTabChange: (tab: Tab) => void
}

export function PayoutTabs({ currentTab, onTabChange }: PayoutTabsProps) {
  const isPendingTab = currentTab === 'pending'

  return (
    <div
      className='flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1 w-fit'
      role='tablist'
      aria-label={m.admin_payouts_tab_label()}
    >
      <button
        type='button'
        role='tab'
        aria-selected={isPendingTab}
        onClick={() => onTabChange('pending')}
        className={cn(
          'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
          isPendingTab
            ? 'bg-surface-default text-text-primary shadow-sm'
            : 'text-text-secondary hover:text-text-primary',
        )}
      >
        {m.admin_payouts_tab_pending()}
      </button>
      <button
        type='button'
        role='tab'
        aria-selected={!isPendingTab}
        onClick={() => onTabChange('history')}
        className={cn(
          'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
          !isPendingTab
            ? 'bg-surface-default text-text-primary shadow-sm'
            : 'text-text-secondary hover:text-text-primary',
        )}
      >
        {m.admin_payouts_tab_history()}
      </button>
    </div>
  )
}
