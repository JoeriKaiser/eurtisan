import { useRouter } from '@tanstack/react-router'
import { X } from 'lucide-react'
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
import { openDispute } from '#/lib/disputes'
import { getLocalizedErrorMessage } from '#/lib/error-mapping'
import type { OrderShopGroup } from '#/lib/orders.server'
import { m } from '#/paraglide/messages'

export interface DisputeDialogProps {
  shop: OrderShopGroup
  onClose: () => void
  onOpened: (disputeId: string, shopOrderId: string) => void
}

export function DisputeDialog({ shop, onClose, onOpened }: DisputeDialogProps) {
  const router = useRouter()
  const [disputeReason, setDisputeReason] = useState('item_not_received')
  const [disputeDescription, setDisputeDescription] = useState('')
  const [disputeConfirmed, setDisputeConfirmed] = useState(false)
  const [isDisputeSubmitting, setIsDisputeSubmitting] = useState(false)
  const [disputeError, setDisputeError] = useState<string | null>(null)

  const handleSubmitDispute = async () => {
    const requiresNonDeliveryConfirmation = shop.status !== 'delivered'
    if (!disputeDescription.trim() || (requiresNonDeliveryConfirmation && !disputeConfirmed)) return
    setIsDisputeSubmitting(true)
    setDisputeError(null)
    try {
      const result = await openDispute({
        data: {
          shopOrderId: shop.shopOrderId,
          reason: disputeReason,
          description: disputeDescription.trim(),
        },
      })
      onOpened(result.id, shop.shopOrderId)
      router.invalidate()
      onClose()
    } catch (err) {
      if (err instanceof Response) {
        const body = await err.json().catch(() => ({ message: 'Unknown error' }))
        const errorMsg = getLocalizedErrorMessage(body.code || body.message)
        setDisputeError(errorMsg || 'Failed to open dispute')
      } else {
        setDisputeError('Failed to open dispute')
      }
    } finally {
      setIsDisputeSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-md'>
          <div className='flex items-center justify-between'>
            <DialogTitle>{m.dispute_modal_title()}</DialogTitle>
            <button
              type='button'
              onClick={onClose}
              className='rounded-lg p-1 text-text-muted transition-colors hover:bg-bg-inset hover:text-text-primary'
              aria-label={m.dispute_modal_close()}
            >
              <X size={18} aria-hidden='true' />
            </button>
          </div>
          <DialogDescription>{m.dispute_modal_description()}</DialogDescription>

          <form
            className='mt-4 space-y-4'
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmitDispute()
            }}
          >
            <div>
              {shop.status === 'delivered' ? (
                <>
                  <label
                    htmlFor='dispute-reason'
                    className='mb-1.5 block text-sm font-medium text-text-primary'
                  >
                    {m.dispute_reason_label()}
                  </label>
                  <select
                    id='dispute-reason'
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    disabled={isDisputeSubmitting}
                    className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:opacity-50'
                  >
                    <option value='item_not_received'>
                      {m.dispute_reason_item_not_received()}
                    </option>
                    <option value='not_as_described'>{m.dispute_reason_not_as_described()}</option>
                    <option value='damaged'>{m.dispute_reason_damaged()}</option>
                    <option value='other'>{m.dispute_reason_other()}</option>
                  </select>
                </>
              ) : (
                <>
                  <p className='mb-1.5 text-sm font-medium text-text-primary'>
                    {m.dispute_reason_label()}
                  </p>
                  <p className='rounded-lg border border-border-default bg-surface-inset px-3 py-2 text-sm text-text-primary'>
                    {m.dispute_reason_item_not_received()}
                  </p>
                </>
              )}
            </div>

            <div>
              <label
                htmlFor='dispute-description'
                className='mb-1.5 block text-sm font-medium text-text-primary'
              >
                {m.dispute_description_label()}
              </label>
              <textarea
                id='dispute-description'
                rows={4}
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                placeholder={m.dispute_description_placeholder()}
                aria-label={m.dispute_description_label()}
                className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:opacity-50 resize-none'
                maxLength={5000}
                disabled={isDisputeSubmitting}
                required
              />
              <p className='mt-1 text-right text-xs text-text-muted'>
                {disputeDescription.length}/5000
              </p>
            </div>

            {shop.status !== 'delivered' && (
              <>
                <p className='text-xs text-text-muted'>
                  {m.order_non_delivery_evidence_guidance()}
                </p>

                <label className='flex items-start gap-2 text-sm text-text-secondary'>
                  <input
                    type='checkbox'
                    checked={disputeConfirmed}
                    onChange={(event) => setDisputeConfirmed(event.target.checked)}
                    disabled={isDisputeSubmitting}
                    className='mt-1 size-4 accent-accent-primary'
                  />
                  <span>{m.order_non_delivery_confirmation()}</span>
                </label>
              </>
            )}

            <div className='min-h-5' aria-live='polite' aria-atomic='true'>
              {disputeError && <p className='text-sm text-error'>{disputeError}</p>}
            </div>

            <div className='flex justify-end gap-3'>
              <Button
                variant='secondary'
                onClick={onClose}
                disabled={isDisputeSubmitting}
                type='button'
              >
                {m.dispute_cancel()}
              </Button>
              <Button
                type='submit'
                isLoading={isDisputeSubmitting}
                disabled={
                  !disputeDescription.trim() ||
                  (shop.status !== 'delivered' && !disputeConfirmed) ||
                  isDisputeSubmitting
                }
              >
                {m.dispute_submit()}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
