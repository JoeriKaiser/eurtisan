import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { CheckCircle2, Clock3, Package, Truck } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Select } from '#/components/ui/select'
import { useAuth } from '#/lib/auth/hooks'
import { manageReturnRequest, updateReturnShipment } from '#/lib/returns'
import type { ReturnRequestSummary } from '#/lib/returns'
import { DIMINISHED_VALUE_CATEGORIES } from '#/lib/returns/schemas'
import type { DiminishedValueCategory } from '#/lib/returns/types'
import { m } from '#/paraglide/messages'

function formatCurrency(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(
    cents / 100,
  )
}

const CATEGORY_LABELS: Record<DiminishedValueCategory, () => string> = {
  worn_washed: m.return_cat_worn_washed,
  scratched_damaged: m.return_cat_scratched_damaged,
  missing_packaging: m.return_cat_missing_packaging,
  broken_seal: m.return_cat_broken_seal,
  structural_damage: m.return_cat_structural_damage,
}

function isDiminishedValueCategory(value: string): value is DiminishedValueCategory {
  return (DIMINISHED_VALUE_CATEGORIES as readonly string[]).includes(value)
}

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
    disputed: m.return_status_disputed(),
  }
  return labels[status]
}

export function ReturnDetailPage({ request }: { request: ReturnRequestSummary }) {
  const router = useRouter()
  const { user } = useAuth()
  const isPrivileged = user?.role === 'creator' || user?.role === 'admin'
  const [carrier, setCarrier] = useState(request.carrier ?? '')
  const [trackingNumber, setTrackingNumber] = useState(request.trackingNumber ?? '')
  const [diminishedEuros, setDiminishedEuros] = useState(
    request.diminishedValueCents > 0 ? (request.diminishedValueCents / 100).toFixed(2) : '',
  )
  const [diminishedCategory, setDiminishedCategory] = useState<string>(
    request.diminishedValueCategory ?? '',
  )
  const [diminishedReason, setDiminishedReason] = useState(request.diminishedValueReason ?? '')
  const [diminishedEvidenceUrl, setDiminishedEvidenceUrl] = useState(
    request.diminishedValueEvidenceUrls?.[0] ?? '',
  )
  const [restockMap, setRestockMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const item of request.items) {
      map[item.orderItemId] = item.restockItem ?? true
    }
    return map
  })
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
      const deductionCents = Math.max(0, Math.round((parseFloat(diminishedEuros) || 0) * 100))
      const hasDeduction = deductionCents > 0
      const restockItems = request.items.map((item) => ({
        orderItemId: item.orderItemId,
        restock: restockMap[item.orderItemId] ?? true,
      }))

      await manageReturnRequest({
        data: {
          returnRequestId: request.id,
          action,
          reason,
          ...(action === 'refund'
            ? {
                diminishedValueCents: deductionCents,
                diminishedValueCategory:
                  hasDeduction && isDiminishedValueCategory(diminishedCategory)
                    ? diminishedCategory
                    : undefined,
                diminishedValueReason:
                  hasDeduction && diminishedReason.trim() ? diminishedReason.trim() : undefined,
                diminishedValueEvidenceUrls:
                  hasDeduction && diminishedEvidenceUrl.trim()
                    ? [diminishedEvidenceUrl.trim()]
                    : undefined,
                restockItems,
              }
            : {}),
        },
      })
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
                date: new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
                  new Date(request.returnDeadline),
                ),
              })}
            </p>
          )}
        </header>
        {request.status === 'disputed' && (
          <div
            role='status'
            className='border-b border-warning/30 bg-warning-subtle px-5 py-4 text-sm font-medium text-warning sm:px-8'
          >
            {m.return_dispute_notice()}
          </div>
        )}

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
                    {formatCurrency(item.refundCents)}
                  </p>
                </div>
              ))}
              <div className='flex justify-between gap-4 p-4 text-sm font-semibold text-text-primary'>
                <span>{m.return_refund_total()}</span>
                <span>{formatCurrency(request.refundCents)}</span>
              </div>
            </div>
          </section>
          {request.diminishedValueCents > 0 && (
            <section
              aria-labelledby='return-deduction-breakdown-heading'
              className='rounded-xl border border-border-default bg-surface-subtle p-5 sm:p-6'
            >
              <h2
                id='return-deduction-breakdown-heading'
                className='text-base font-semibold text-text-primary'
              >
                {m.return_diminished_value_heading()}
              </h2>
              <div className='mt-4 divide-y divide-border-subtle rounded-xl border border-border-default bg-surface-default'>
                <div className='flex justify-between gap-4 p-4 text-sm text-text-secondary'>
                  <span>{m.return_refund_total()}</span>
                  <span className='font-medium text-text-primary'>
                    {formatCurrency(request.refundCents)}
                  </span>
                </div>
                <div className='flex justify-between gap-4 p-4 text-sm font-medium text-error'>
                  <span>{m.return_deduction_itemized()}</span>
                  <span>-{formatCurrency(request.diminishedValueCents)}</span>
                </div>
                <div className='flex justify-between gap-4 p-4 text-sm text-text-secondary'>
                  <div>
                    <span>Outbound standard shipping</span>
                    <p className='text-xs text-text-muted'>
                      Standard shipping is protected and non-deductible under Article 14(2).
                    </p>
                  </div>
                  <span className='font-medium text-text-primary'>
                    {formatCurrency(request.outboundShippingRefundCents)}
                  </span>
                </div>
                <div className='flex justify-between gap-4 p-4 text-sm font-semibold text-text-primary'>
                  <span>{m.return_net_refund()}</span>
                  <span>{formatCurrency(request.netRefundCents)}</span>
                </div>
              </div>

              <div className='mt-4 space-y-3 rounded-xl border border-border-default bg-surface-default p-4 text-sm'>
                {request.diminishedValueCategory && (
                  <div>
                    <span className='font-semibold text-text-secondary'>
                      {m.return_diminished_value_category()}:{' '}
                    </span>
                    <span className='text-text-primary'>
                      {isDiminishedValueCategory(request.diminishedValueCategory)
                        ? CATEGORY_LABELS[request.diminishedValueCategory]()
                        : request.diminishedValueCategory}
                    </span>
                  </div>
                )}
                {request.diminishedValueReason && (
                  <div>
                    <span className='font-semibold text-text-secondary'>
                      {m.return_diminished_value_reason()}:{' '}
                    </span>
                    <p className='mt-1 text-text-primary'>{request.diminishedValueReason}</p>
                  </div>
                )}
                {request.diminishedValueEvidenceUrls &&
                  request.diminishedValueEvidenceUrls.length > 0 && (
                    <div>
                      <span className='font-semibold text-text-secondary'>
                        {m.return_diminished_value_photos()}:
                      </span>
                      <div className='mt-2 flex flex-wrap gap-3'>
                        {request.diminishedValueEvidenceUrls.map((url, index) => (
                          <a
                            key={url}
                            href={url}
                            target='_blank'
                            rel='noreferrer'
                            className='group flex items-center gap-2 rounded-lg border border-border-default bg-surface-subtle p-2 transition-colors hover:border-accent-primary no-underline'
                          >
                            <img
                              src={url}
                              alt={`Evidence ${index + 1}`}
                              className='size-12 rounded object-cover'
                            />
                            <span className='text-xs font-medium text-accent-primary group-hover:underline'>
                              Evidence {index + 1}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </section>
          )}
          PUT 263*.=301:
          {isPrivileged && (
            <section aria-labelledby='return-actions-heading' className='space-y-4'>
              <h2 id='return-actions-heading' className='text-base font-semibold text-text-primary'>
                {m.return_seller_actions()}
              </h2>

              {['received', 'refund_pending'].includes(request.status) && (
                <div className='space-y-4 rounded-xl border border-border-default bg-surface-subtle p-4 sm:p-5'>
                  <h3 className='text-sm font-semibold text-text-primary'>
                    {m.return_diminished_value_heading()}
                  </h3>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <div>
                      <Label htmlFor='diminished-value-amount'>
                        {m.return_diminished_value_amount()}
                      </Label>
                      <Input
                        id='diminished-value-amount'
                        type='number'
                        step='0.01'
                        min='0'
                        placeholder='0.00'
                        value={diminishedEuros}
                        onChange={(e) => setDiminishedEuros(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor='diminished-category'>
                        {m.return_diminished_value_category()}
                      </Label>
                      <Select
                        id='diminished-category'
                        value={diminishedCategory}
                        onChange={(e) => setDiminishedCategory(e.target.value)}
                      >
                        <option value=''>-- Select category --</option>
                        {DIMINISHED_VALUE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {CATEGORY_LABELS[cat]?.() ?? cat}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor='diminished-reason'>{m.return_diminished_value_reason()}</Label>
                    <Input
                      id='diminished-reason'
                      placeholder={m.return_diminished_value_reason()}
                      value={diminishedReason}
                      onChange={(e) => setDiminishedReason(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor='diminished-photos'>{m.return_diminished_value_photos()}</Label>
                    <Input
                      id='diminished-photos'
                      type='url'
                      placeholder='https://...'
                      value={diminishedEvidenceUrl}
                      onChange={(e) => setDiminishedEvidenceUrl(e.target.value)}
                    />
                  </div>

                  <div className='space-y-2 pt-2'>
                    <Label>{m.return_items_heading()}</Label>
                    <div className='divide-y divide-border-subtle rounded-lg border border-border-default bg-surface-default'>
                      {request.items.map((item) => (
                        <div
                          key={item.id}
                          className='flex items-center justify-between p-3 text-sm'
                        >
                          <div>
                            <p className='font-medium text-text-primary'>{item.productName}</p>
                            <p className='text-xs text-text-muted'>
                              {m.return_quantity_count({ count: item.quantity })}
                            </p>
                          </div>
                          <label
                            htmlFor={`restock-${item.orderItemId}`}
                            className='flex cursor-pointer items-center gap-2'
                          >
                            <span className='text-xs font-medium text-text-secondary'>
                              {m.return_restock_item()}
                            </span>
                            <input
                              id={`restock-${item.orderItemId}`}
                              type='checkbox'
                              checked={restockMap[item.orderItemId] ?? true}
                              onChange={(e) =>
                                setRestockMap((prev) => ({
                                  ...prev,
                                  [item.orderItemId]: e.target.checked,
                                }))
                              }
                              className='size-4 rounded border-border-default text-accent-primary focus:ring-accent-secondary'
                              aria-label={`${m.return_restock_item()}: ${item.productName}`}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className='flex flex-wrap gap-3'>
                {(request.status === 'requested' ||
                  (request.status === 'authorized' &&
                    request.returnShippingPayer === 'seller' &&
                    !request.labelUrl)) && (
                  <>
                    <Button isLoading={state.loading} onClick={() => void manage('authorize')}>
                      {m.return_authorize()}
                    </Button>
                    {request.status === 'requested' &&
                      (request.type === 'defective' ? (
                        <Button
                          variant='secondary'
                          disabled={state.loading}
                          onClick={() => void manage('reject')}
                        >
                          {m.return_reject()}
                        </Button>
                      ) : (
                        <p className='self-center text-sm text-text-secondary'>
                          {m.return_cannot_reject_withdrawal()}
                        </p>
                      ))}
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
          {request.status === 'refunded' && request.diminishedValueCents > 0 && !isPrivileged && (
            <section
              aria-labelledby='return-mediation-heading'
              className='rounded-xl border border-border-default bg-surface-subtle p-5 sm:p-6'
            >
              <h2
                id='return-mediation-heading'
                className='text-base font-semibold text-text-primary'
              >
                {m.return_request_mediation()}
              </h2>
              <p className='mt-2 text-sm text-text-secondary'>
                If you disagree with the condition deduction applied to your refund, you can request
                platform mediation to resolve the dispute.
              </p>
              <div className='mt-4'>
                <Link
                  // Unchecked cast: /disputes/new route is resolved dynamically
                  to={'/disputes/new' as unknown as string}
                  search={
                    {
                      shopOrderId: request.shopOrderId,
                      returnRequestId: request.id,
                    } as unknown as Record<string, unknown>
                  }
                  className='inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-primary px-4 text-sm font-semibold text-text-on-primary shadow-sm hover:bg-accent-primary-hover no-underline'
                >
                  {m.return_request_mediation()}
                </Link>
              </div>
            </section>
          )}
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
          {request.status === 'rejected' ? (
            <section
              aria-labelledby='return-rejected-heading'
              className='space-y-3 rounded-xl bg-error/10 p-4 text-sm text-error sm:p-5'
            >
              <h2 id='return-rejected-heading' className='font-semibold'>
                {m.return_status_rejected()}
              </h2>
              {request.rejectionReason && <p>{request.rejectionReason}</p>}
              <div>
                <Link
                  // Unchecked cast: /disputes/new route is resolved dynamically
                  to={'/disputes/new' as unknown as string}
                  search={
                    {
                      shopOrderId: request.shopOrderId,
                      returnRequestId: request.id,
                    } as unknown as Record<string, unknown>
                  }
                  className='inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-primary px-4 text-sm font-semibold text-text-on-primary shadow-sm hover:bg-accent-primary-hover no-underline'
                >
                  {m.return_escalate_dispute()}
                </Link>
              </div>
            </section>
          ) : request.rejectionReason ? (
            <p role='alert' className='rounded-xl bg-error/10 p-4 text-sm text-error'>
              {request.rejectionReason}
            </p>
          ) : null}
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
