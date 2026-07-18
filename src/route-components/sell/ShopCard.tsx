import { Link, useRouter } from '@tanstack/react-router'
import { Store, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { getImageUrl } from '#/lib/image-url'
import { deleteShopDraft, type getSellerShops } from '#/lib/sell-onboarding'
import { normalizeOnboardingStage, SELL_ONBOARDING_STAGE_COUNT } from '#/lib/sell-onboarding-steps'
import { m } from '#/paraglide/messages'
import { trackEvent } from '#/integrations/umami'

const statusStyles: Record<string, string> = {
  draft: 'bg-warning-subtle text-warning',
  pending_review: 'bg-accent-secondary-subtle text-accent-secondary',
  changes_requested: 'bg-warning-subtle text-warning',
  approved: 'bg-accent-secondary-subtle text-accent-secondary',
  active: 'bg-success-subtle text-success',
  rejected: 'bg-error-subtle text-error',
  suspended: 'bg-error-subtle text-error',
}

const statusLabels: Record<string, () => string> = {
  draft: () => m.seller_hub_status_draft(),
  pending_review: () => m.seller_hub_status_pending(),
  changes_requested: () => m.seller_hub_status_changes(),
  approved: () => m.seller_hub_status_approved(),
  active: () => m.seller_hub_status_active(),
  rejected: () => m.seller_hub_status_rejected(),
  suspended: () => m.seller_hub_status_suspended(),
}

export function ShopCard({ shop }: { shop: Awaited<ReturnType<typeof getSellerShops>>[number] }) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const editable = shop.status === 'draft' || shop.status === 'changes_requested'
  const statusOnly = ['pending_review', 'approved', 'rejected', 'suspended'].includes(shop.status)
  const href = editable
    ? `/sell/onboarding/${shop.id}`
    : statusOnly
      ? `/sell/status/${shop.id}`
      : `/creator?shopId=${shop.id}`
  const action = editable
    ? m.seller_hub_continue_setup()
    : statusOnly
      ? m.seller_hub_check_status()
      : m.seller_hub_view_dashboard()

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteShopDraft({ data: { shopId: shop.id } })
      setDeleteOpen(false)
      await router.invalidate()
    } catch {
      setDeleteError(m.seller_hub_delete_error())
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article className='rounded-2xl border border-border-default bg-surface-default p-5'>
      <div className='flex items-start gap-3'>
        <div className='flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-inset'>
          {shop.image ? (
            <img src={getImageUrl(shop.image)} alt='' className='size-full object-cover' />
          ) : (
            <Store size={20} className='text-text-muted' aria-hidden='true' />
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <h2 className='truncate font-semibold text-text-primary'>
            {shop.name || m.onboarding_untitled_shop()}
          </h2>
          <span
            className={`mt-1 inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusStyles[shop.status] ?? 'bg-surface-inset text-text-secondary'}`}
          >
            {statusLabels[shop.status]?.() ?? shop.status}
          </span>
        </div>
        {editable && (
          <button
            type='button'
            onClick={() => setDeleteOpen(true)}
            className='flex size-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-error-subtle hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
            aria-label={m.seller_hub_delete_draft_label({
              name: shop.name || m.onboarding_untitled_shop(),
            })}
          >
            <Trash2 size={17} aria-hidden='true' />
          </button>
        )}
      </div>

      <dl className='mt-4 grid grid-cols-2 gap-3 text-sm'>
        <div>
          <dt className='text-xs text-text-muted'>{m.seller_hub_listings()}</dt>
          <dd className='mt-1 font-medium text-text-primary'>{shop.productCount}</dd>
        </div>
        <div>
          <dt className='text-xs text-text-muted'>{m.seller_hub_progress()}</dt>
          <dd className='mt-1 font-medium text-text-primary'>
            {m.onboarding_step_count({
              current: String(normalizeOnboardingStage(shop.onboardingStep)),
              total: String(SELL_ONBOARDING_STAGE_COUNT),
            })}
          </dd>
        </div>
      </dl>

      {shop.status === 'changes_requested' && shop.moderationNote && (
        <p className='mt-4 rounded-lg bg-warning-subtle p-3 text-sm text-warning'>
          {shop.moderationNote}
        </p>
      )}

      <Link
        to={href}
        onClick={() => {
          if (editable) void trackEvent('seller_onboarding_resumed', { stage: shop.onboardingStep })
        }}
        className='mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border-default bg-surface-default px-4 text-sm font-semibold text-text-primary no-underline transition-colors hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
      >
        {action}
      </Link>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='mx-4 max-w-md'>
            <DialogTitle>{m.seller_hub_delete_draft_title()}</DialogTitle>
            <DialogDescription>
              {m.seller_hub_delete_draft_description({
                name: shop.name || m.onboarding_untitled_shop(),
              })}
            </DialogDescription>
            {deleteError && (
              <p role='alert' className='mt-4 text-sm text-error'>
                {deleteError}
              </p>
            )}
            <div className='mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
              <Button variant='secondary' onClick={() => setDeleteOpen(false)} disabled={deleting}>
                {m.seller_hub_keep_draft()}
              </Button>
              <Button variant='danger' onClick={() => void handleDelete()} isLoading={deleting}>
                {m.seller_hub_delete_draft()}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </article>
  )
}
