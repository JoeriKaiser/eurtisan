import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { Skeleton } from '#/components/ui/skeleton'
import { getShopDraft, getShopDraftListings, type ShopDraft } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'
import { ProductListingsSection } from './application-review/ProductListingsSection'
import { ReviewActionsPanel } from './application-review/ReviewActionsPanel'
import { ShopIdentitySection } from './application-review/ShopIdentitySection'
import { ShopPoliciesSection } from './application-review/ShopPoliciesSection'
import { ShopStorySection } from './application-review/ShopStorySection'
import { ShopVisualsSection } from './application-review/ShopVisualsSection'

interface AppListing {
  id: string
  name: string
  description: string | null
  priceCents: number
  stockCount: number
  imageCount: number
  thumbnailUrl: string | null
}

interface DetailState {
  details: ShopDraft | null
  listings: AppListing[]
  isLoading: boolean
  error: string | null
}

interface ApplicationReviewDialogProps {
  appId: string | null
  onClose: () => void
  onReviewAction: (action: 'approve' | 'request_changes' | 'reject', note: string) => void
  isProcessing: boolean
  actionType: 'approve' | 'request_changes' | 'reject' | null
}

export function ApplicationReviewDialog({
  appId,
  onClose,
  onReviewAction,
  isProcessing,
  actionType,
}: ApplicationReviewDialogProps) {
  const [state, setState] = useState<DetailState>({
    details: null,
    listings: [],
    isLoading: !!appId,
    error: null,
  })
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!appId) return

    let cancelled = false

    Promise.all([
      getShopDraft({ data: { draftId: appId } }),
      getShopDraftListings({ data: { shopId: appId } }),
    ])
      .then(([details, listings]) => {
        if (cancelled) return
        setState({
          details,
          listings: listings.products || [],
          isLoading: false,
          error: null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          details: null,
          listings: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load details',
        })
      })

    return () => {
      cancelled = true
    }
  }, [appId])

  const handleAction = (action: 'approve' | 'request_changes' | 'reject') => {
    onReviewAction(action, note.trim())
  }

  const { details, listings, isLoading, error } = state

  return (
    <Dialog open={!!appId} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0'>
          <div className='flex items-center justify-between border-b border-border-subtle px-6 py-4 flex-shrink-0'>
            <DialogTitle className='text-xl'>
              {isLoading || !details
                ? m.admin_shops_review_details()
                : m.admin_shops_application_details_title({ name: details.name })}
            </DialogTitle>
            <button
              type='button'
              onClick={onClose}
              className='rounded p-1 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
              aria-label={m.admin_shops_cancel()}
            >
              <X size={18} />
            </button>
          </div>

          <div className='overflow-y-auto flex-1 min-h-0 px-6 py-4'>
            {isLoading || !details ? (
              <div className='space-y-6 py-4'>
                <Skeleton className='size-8/3' />
                <Skeleton className='h-32 w-full rounded-xl' />
                <Skeleton className='h-32 w-full rounded-xl' />
              </div>
            ) : error ? (
              <div className='rounded-lg border border-error/30 bg-error-subtle p-4 text-sm text-error'>
                {error}
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-3 gap-6 py-2'>
                <div className='md:col-span-2 space-y-6'>
                  <ShopIdentitySection details={details} />
                  <ShopStorySection details={details} />
                  <ShopVisualsSection image={details.image} bannerImage={details.bannerImage} />
                  <ShopPoliciesSection details={details} />
                  <ProductListingsSection listings={listings} />
                </div>

                <div className='md:col-span-1'>
                  <ReviewActionsPanel
                    note={note}
                    onNoteChange={setNote}
                    onAction={handleAction}
                    isProcessing={isProcessing}
                    actionType={actionType}
                  />
                </div>
              </div>
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
