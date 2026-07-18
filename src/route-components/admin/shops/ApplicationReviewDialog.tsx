import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
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

interface ApplicationDetails {
  details: ShopDraft
  listings: AppListing[]
}

interface ApplicationReviewDialogProps {
  appId: string | null
  onClose: () => void
  onReviewAction: (
    action: 'approve' | 'request_changes' | 'reject',
    note: string,
    stage: number,
  ) => void
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
  const [note, setNote] = useState('')
  const [stage, setStage] = useState(1)
  const detailsQuery = useQuery<ApplicationDetails>({
    queryKey: ['admin', 'shop-application', appId],
    queryFn: async () => {
      if (!appId) throw new Error('Application id is required')
      const [details, listings] = await Promise.all([
        getShopDraft({ data: { draftId: appId } }),
        getShopDraftListings({ data: { shopId: appId } }),
      ])
      return { details, listings: listings.products || [] }
    },
    enabled: appId !== null,
    staleTime: 30_000,
  })

  const handleAction = (action: 'approve' | 'request_changes' | 'reject') => {
    onReviewAction(action, note.trim(), stage)
  }

  const details = detailsQuery.data?.details ?? null
  const listings = detailsQuery.data?.listings ?? []
  const isLoading = detailsQuery.isPending && appId !== null
  const error = detailsQuery.error

  return (
    <Dialog open={!!appId} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='!w-[calc(100vw-2rem)] !max-w-7xl max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col p-0'>
          <div className='flex shrink-0 items-center justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-6'>
            <DialogTitle className='text-xl'>
              {isLoading || !details
                ? m.admin_shops_review_details()
                : m.admin_shops_application_details_title({ name: details.name })}
            </DialogTitle>
            <button
              type='button'
              onClick={onClose}
              className='inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
              aria-label={m.admin_shops_cancel()}
            >
              <X size={18} />
            </button>
          </div>

          <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6'>
            {error ? (
              <div
                className='rounded-lg border border-error/30 bg-error-subtle p-4 text-sm text-error'
                role='alert'
              >
                {error instanceof Error ? error.message : m.error_unexpected()}
              </div>
            ) : isLoading || !details ? (
              <div className='space-y-6 py-4' aria-live='polite'>
                <Skeleton className='size-8/3' />
                <Skeleton className='h-32 w-full rounded-xl' />
                <Skeleton className='h-32 w-full rounded-xl' />
              </div>
            ) : (
              <div className='grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]'>
                <div className='grid min-w-0 grid-cols-1 content-start gap-6 xl:grid-cols-2'>
                  <ShopIdentitySection details={details} />
                  <ShopStorySection details={details} />
                  <ShopVisualsSection image={details.image} bannerImage={details.bannerImage} />
                  <ShopPoliciesSection details={details} />
                  <div className='xl:col-span-2'>
                    <ProductListingsSection listings={listings} />
                  </div>
                </div>

                <aside
                  className='order-first min-w-0 lg:order-none'
                  aria-label={m.admin_shops_review_decision_title()}
                >
                  <ReviewActionsPanel
                    note={note}
                    onNoteChange={setNote}
                    stage={stage}
                    onStageChange={setStage}
                    onAction={handleAction}
                    isProcessing={isProcessing}
                    actionType={actionType}
                  />
                </aside>
              </div>
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
