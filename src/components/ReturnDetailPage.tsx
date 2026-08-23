import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { CheckCircle2, Clock3, Package, Truck } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { useAuth } from '#/lib/auth/hooks'
import { formatDateLong } from '#/lib/format-date'
import { formatPriceEUR } from '#/lib/pricing'
import { manageReturnRequest, updateReturnShipment } from '#/lib/returns'
import type { ReturnRequestSummary } from '#/lib/returns'
import { m } from '#/paraglide/messages'

function getReturnStatusLabel(status: ReturnRequestSummary['status']) {
  const labels = {
    requested: m.return_status_requested(),
    authorized: m.return_status_authorized(),
    awaiting_shipment: m.return_status_awaiting_shipment(),
    in_transit: m.return_status_in_transit(),
    received: m.return_status_received(),
    refund_pending: m.return_status_refund_pending(),
    refunded: m.return_status_refunded(),
    rejected: m.return_status_rejected(),
    closed: m.return_status_closed(),
  }
  return labels[status]
}

export function ReturnDetailPage({ request }: { request: ReturnRequestSummary }) {
  const router = useRouter()
  const { user } = useAuth()
  const isPrivileged = user?.role === 'creator' || user?.role === 'admin'
  const [carrier, setCarrier] = useState(request.carrier ?? '')
  const [trackingNumber, setTrackingNumber] = useState(request.trackingNumber ?? '')
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  })

  const refresh = async () => {
    await router.invalidate()
    setState({ loading: false, error: null })
  }

  const submitShipment = async () => {
    setState({ loading: true, error: null })
    try {
      await updateReturnShipment({ data: { returnRequestId: request.id, carrier, trackingNumber } })
      await refresh()
    } catch {
      setState({ loading: false, error: m.return_update_error() })
    }
  }

  const manage = async (action: 'authorize' | 'reject' | 'mark_received' | 'refund' | 'close') => {
    let reason: string | undefined
    if (action === 'reject') {
      reason = window.prompt(m.return_rejection_prompt())?.trim()
      if (!reason) return
    }
    setState({ loading: true, error: null })
    try {
      await manageReturnRequest({ data: { returnRequestId: request.id, action, reason } })
      await refresh()
    } catch {
      setState({ loading: false, error: m.return_update_error() })
    }
  }

  const canSubmitTracking = ['authorized', 'awaiting_shipment'].includes(request.status)

  return (
    <main className='mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12'>
      <Link
        to='/orders'
        className='inline-flex min-h-11 items-center text-sm font-semibold text-text-secondary no-underline hover:text-text-primary'
      >
        {m.return_back_to_orders()}
      </Link>
      <div className='mt-3 overflow-hidden rounded-2xl border border-border-default bg-surface-elevated shadow-sm'>
        <header className='border-b border-border-default p-5 sm:p-8'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div>
              <p className='text-sm font-semibold uppercase tracking-wide text-accent-primary'>
                {m.return_request_label()}
              </p>
              <h1 className='mt-1 font-serif text-2xl font-semibold text-text-primary sm:text-3xl'>
                {m.return_status({ status: getReturnStatusLabel(request.status) })}
              </h1>
            </div>
            <span className='rounded-full bg-accent-primary/10 px-3 py-1.5 text-sm font-semibold text-accent-primary'>
              {request.type === 'withdrawal'
                ? m.return_type_withdrawal()
                : m.return_type_defective()}
            </span>
          </div>
          <p className='mt-4 max-w-2xl text-sm leading-relaxed text-text-secondary'>
            {request.reason}
          </p>
          {['authorized', 'awaiting_shipment'].includes(request.status) && (
            <p className='mt-3 text-sm font-medium text-text-primary'>
              {m.return_ship_by({
                date: formatDateLong(request.returnDeadline),
              })}
            </p>
          )}
        </header>

        <div className='space-y-8 p-5 sm:p-8'>
          <section aria-labelledby='return-items-heading'>
            <h2
              id='return-items-heading'
              className='flex items-center gap-2 text-base font-semibold text-text-primary'
            >
              <Package size={18} aria-hidden='true' />
              {m.return_items_heading()}
            </h2>
            <div className='mt-3 divide-y divide-border-subtle rounded-xl border border-border-default'>
              {request.items.map((item) => (
                <div key={item.id} className='flex justify-between gap-4 p-4 text-sm'>
                  <div>
                    <p className='font-medium text-text-primary'>{item.productName}</p>
                    <p className='text-text-muted'>
                      {m.return_quantity_count({ count: item.quantity })}
                    </p>
                  </div>
                  <p className='font-semibold text-text-primary'>
                    {formatPriceEUR(item.refundCents)}
                  </p>
                </div>
              ))}
              <div className='flex justify-between gap-4 p-4 text-sm font-semibold text-text-primary'>
                <span>{m.return_refund_total()}</span>
                <span>{formatPriceEUR(request.refundCents)}</span>
              </div>
            </div>
          </section>

          {request.labelUrl && (
            <section className='rounded-xl border border-accent-primary/30 bg-accent-primary/5 p-4'>
              <h2 className='flex items-center gap-2 text-sm font-semibold text-text-primary'>
                <Truck size={18} aria-hidden='true' />
                {m.return_label_ready()}
              </h2>
              <a
                href={request.labelUrl}
                target='_blank'
                rel='noreferrer'
                className='mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent-primary underline-offset-2 hover:underline'
              >
                {m.return_download_label()}
              </a>
            </section>
          )}

          {!isPrivileged && canSubmitTracking && !request.labelUrl && (
            <section aria-labelledby='return-tracking-heading'>
              <h2
                id='return-tracking-heading'
                className='flex items-center gap-2 text-base font-semibold text-text-primary'
              >
                <Truck size={18} aria-hidden='true' />
                {m.return_tracking_heading()}
              </h2>
              <p className='mt-2 text-sm text-text-secondary'>{m.return_tracking_help()}</p>
              <div className='mt-4 grid gap-4 sm:grid-cols-2'>
                <div>
                  <Label htmlFor='return-carrier'>{m.return_carrier()}</Label>
                  <Input
                    id='return-carrier'
                    value={carrier}
                    onChange={(event) => setCarrier(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor='return-tracking-number'>{m.return_tracking_number()}</Label>
                  <Input
                    id='return-tracking-number'
                    value={trackingNumber}
                    onChange={(event) => setTrackingNumber(event.target.value)}
                  />
                </div>
              </div>
              <Button
                className='mt-4'
                disabled={carrier.trim().length < 2 || trackingNumber.trim().length < 3}
                isLoading={state.loading}
                onClick={() => void submitShipment()}
              >
                {m.return_save_tracking()}
              </Button>
            </section>
          )}

          {isPrivileged && (
            <section aria-labelledby='return-actions-heading'>
              <h2 id='return-actions-heading' className='text-base font-semibold text-text-primary'>
                {m.return_seller_actions()}
              </h2>
              <div className='mt-3 flex flex-wrap gap-3'>
                {(request.status === 'requested' ||
                  (request.status === 'authorized' &&
                    request.returnShippingPayer === 'seller' &&
                    !request.labelUrl)) && (
                  <>
                    <Button isLoading={state.loading} onClick={() => void manage('authorize')}>
                      {m.return_authorize()}
                    </Button>
                    {request.status === 'requested' && (
                      <Button
                        variant='secondary'
                        disabled={state.loading}
                        onClick={() => void manage('reject')}
                      >
                        {m.return_reject()}
                      </Button>
                    )}
                  </>
                )}
                {['in_transit', 'awaiting_shipment'].includes(request.status) && (
                  <Button isLoading={state.loading} onClick={() => void manage('mark_received')}>
                    <CheckCircle2 size={17} aria-hidden='true' />
                    {m.return_mark_received()}
                  </Button>
                )}
                {['received', 'refund_pending'].includes(request.status) && (
                  <Button isLoading={state.loading} onClick={() => void manage('refund')}>
                    {m.return_issue_refund()}
                  </Button>
                )}
              </div>
            </section>
          )}

          {!request.labelUrl && request.trackingNumber && (
            <p className='flex items-center gap-2 text-sm text-text-secondary'>
              <Clock3 size={17} aria-hidden='true' />
              {request.carrier}: {request.trackingNumber}
            </p>
          )}
          {request.rejectionReason && (
            <p role='alert' className='rounded-xl bg-error/10 p-4 text-sm text-error'>
              {request.rejectionReason}
            </p>
          )}
          {state.error && (
            <p role='alert' className='text-sm text-error'>
              {state.error}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
