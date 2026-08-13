import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

interface BulkActionBarProps {
  selectedCount: number
  bulkProgress: { current: number; total: number; action: string } | null
  onBulkSuspend: () => void
  onBulkUnsuspend: () => void
}

export function BulkActionBar({
  selectedCount,
  bulkProgress,
  onBulkSuspend,
  onBulkUnsuspend,
}: BulkActionBarProps) {
  if (selectedCount === 0 && !bulkProgress) return null

  return (
    <>
      {selectedCount > 0 && (
        <div className='flex items-center justify-between rounded-lg border border-border-default bg-surface-inset px-4 py-2'>
          <span className='text-sm text-text-secondary'>
            {m.admin_bulk_selected({ count: selectedCount })}
          </span>
          <div className='flex gap-2'>
            <Button variant='danger' size='sm' onClick={onBulkSuspend} disabled={!!bulkProgress}>
              {m.admin_bulk_suspend()}
            </Button>
            <Button
              variant='secondary'
              size='sm'
              onClick={onBulkUnsuspend}
              disabled={!!bulkProgress}
            >
              {m.admin_bulk_unsuspend()}
            </Button>
          </div>
        </div>
      )}

      {bulkProgress && (
        <div className='text-sm text-text-secondary'>
          {m.admin_bulk_progress({
            current: bulkProgress.current,
            total: bulkProgress.total,
          })}
        </div>
      )}
    </>
  )
}
