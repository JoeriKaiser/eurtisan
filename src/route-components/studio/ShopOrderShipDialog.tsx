import { useCallback, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { markShopOrderShipped, markShopOrderShippedWithLabel } from '#/lib/shop-orders'

export function ShopOrderShipDialog({
  orderId,
  open,
  onOpenChange,
  onShipped,
}: {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onShipped: () => void
}) {
  const [form, setForm] = useState({
    mode: 'label' as 'label' | 'manual',
    trackingNumber: '',
    trackingUrl: '',
  })
  const [status, setStatus] = useState({
    isSubmitting: false,
    error: null as string | null,
    fieldErrors: {} as { trackingUrl?: string },
  })
  const validate = useCallback(() => {
    const errors: { trackingUrl?: string } = {}
    if (form.mode === 'manual' && form.trackingUrl.trim()) {
      try {
        new URL(form.trackingUrl.trim())
      } catch {
        errors.trackingUrl = 'Please enter a valid URL'
      }
    }
    setStatus((prev) => ({ ...prev, fieldErrors: errors }))
    return Object.keys(errors).length === 0
  }, [form])
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return
      setStatus((prev) => ({ ...prev, isSubmitting: true, error: null }))
      try {
        if (form.mode === 'label') {
          await markShopOrderShippedWithLabel({ data: { shopOrderId: orderId } })
        } else {
          await markShopOrderShipped({
            data: {
              shopOrderId: orderId,
              trackingNumber: form.trackingNumber.trim() || null,
              trackingUrl: form.trackingUrl.trim() || null,
            },
          })
        }
        onOpenChange(false)
        onShipped()
      } catch (err) {
        if (err instanceof Response) {
          try {
            const body = await err.json()
            setStatus((prev) => ({
              ...prev,
              error: body.message || 'Failed to mark order as shipped',
            }))
          } catch {
            setStatus((prev) => ({
              ...prev,
              error: 'Failed to mark order as shipped',
            }))
          }
        } else if (err instanceof Error) {
          setStatus((prev) => ({ ...prev, error: err.message }))
        } else {
          setStatus((prev) => ({ ...prev, error: 'An unexpected error occurred' }))
        }
      } finally {
        setStatus((prev) => ({ ...prev, isSubmitting: false }))
      }
    },
    [orderId, form, validate, onOpenChange, onShipped],
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='w-full max-w-md'>
            <form onSubmit={handleSubmit}>
              <DialogTitle>Mark as Shipped</DialogTitle>
              <DialogDescription>Choose how to provide tracking for this order.</DialogDescription>
              <div className='mt-4 space-y-4'>
                <div className='flex rounded-lg border border-border-default p-1'>
                  <button
                    type='button'
                    onClick={() => setForm((prev) => ({ ...prev, mode: 'label' }))}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                      form.mode === 'label'
                        ? 'bg-accent-primary text-text-on-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Generate Label
                  </button>
                  <button
                    type='button'
                    onClick={() => setForm((prev) => ({ ...prev, mode: 'manual' }))}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                      form.mode === 'manual'
                        ? 'bg-accent-primary text-text-on-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Manual Tracking
                  </button>
                </div>
                {form.mode === 'manual' && (
                  <>
                    <div>
                      <label
                        htmlFor='tracking-number'
                        className='mb-1.5 block text-sm font-medium text-text-secondary'
                      >
                        Tracking Number
                      </label>
                      <Input
                        id='tracking-number'
                        value={form.trackingNumber}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, trackingNumber: e.target.value }))
                        }
                        placeholder='e.g. TRACK123456'
                        disabled={status.isSubmitting}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor='tracking-url'
                        className='mb-1.5 block text-sm font-medium text-text-secondary'
                      >
                        Tracking URL
                      </label>
                      <Input
                        id='tracking-url'
                        type='url'
                        value={form.trackingUrl}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, trackingUrl: e.target.value }))
                          if (status.fieldErrors.trackingUrl) {
                            setStatus((prev) => ({ ...prev, fieldErrors: {} }))
                          }
                        }}
                        placeholder='https://carrier.example.com/track'
                        disabled={status.isSubmitting}
                        error={status.fieldErrors.trackingUrl}
                      />
                      {status.fieldErrors.trackingUrl && (
                        <p id='tracking-url-error' className='mt-1 text-xs text-error'>
                          {status.fieldErrors.trackingUrl}
                        </p>
                      )}
                    </div>
                  </>
                )}
                {form.mode === 'label' && (
                  <p className='text-sm text-text-secondary'>
                    The system will generate a shipping label via Mondial Relay using your shop's
                    origin address and the buyer's shipping address.
                  </p>
                )}
                {status.error && (
                  <div className='rounded-lg bg-error/10 p-3 text-sm text-error' role='alert'>
                    {status.error}
                  </div>
                )}
              </div>
              <div className='mt-6 flex justify-end gap-3'>
                <Button
                  type='button'
                  variant='ghost'
                  disabled={status.isSubmitting}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type='submit' isLoading={status.isSubmitting}>
                  Mark as Shipped
                </Button>
              </div>
            </form>
          </DialogPopup>
        </DialogPortal>
      )}
    </Dialog>
  )
}
