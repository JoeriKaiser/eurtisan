import { ExternalLink, Package } from 'lucide-react'
import type { OrderShopGroup, OrderStatus } from '#/lib/orders.server'
import { getCarrierTrackingUrl } from '#/lib/shipping'
import { m } from '#/paraglide/messages'

function isValidUrl(url: string | null): url is string {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function formatCarrierName(carrier: string): string {
  return carrier.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTrackingStatus(status: string): string {
  const map: Record<string, string> = {
    label_created: 'Label created',
    in_transit: 'In transit',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered',
  }
  return map[status] ?? status
}

function trackingStatusColorClass(status: string): string {
  if (status === 'delivered') return 'text-success'
  if (status === 'out_for_delivery') return 'text-warning'
  if (status === 'in_transit') return 'text-accent-primary'
  if (status === 'label_created') return 'text-text-secondary'
  return 'text-text-secondary'
}

function getStatusProgress(status: OrderStatus): number {
  const steps: OrderStatus[] = [
    'pending_payment',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'completed',
  ]
  const index = steps.indexOf(status)
  if (index === -1) return 0
  return ((index + 1) / steps.length) * 100
}

export interface ShopTrackingPanelProps {
  shop: OrderShopGroup
}

export function ShopTrackingPanel({ shop }: ShopTrackingPanelProps) {
  return (
    <>
      {/* Progress indicator for non-terminal statuses */}
      {!['cancelled', 'refunded', 'disputed', 'delivered', 'completed'].includes(shop.status) && (
        <div className='space-y-1'>
          <progress
            className='block h-2 w-full overflow-hidden rounded-full bg-surface-inset accent-accent-primary [&::-webkit-progress-bar]:bg-surface-inset [&::-webkit-progress-value]:bg-accent-primary [&::-moz-progress-bar]:bg-accent-primary'
            max={100}
            value={Math.round(getStatusProgress(shop.status))}
            aria-label={`${shop.shopName} order progress`}
          />
          <p className='text-xs text-text-muted'>
            {Math.round(getStatusProgress(shop.status))}% {m.order_detail_shop_status()}
          </p>
        </div>
      )}

      {/* Tracking Information */}
      {shop.shippingLabels.length > 0 ? (
        <div className='space-y-2'>
          {shop.shippingLabels.map((label, idx) => (
            <div
              key={label.createdAt.getTime()}
              className='rounded-lg border border-border-default bg-surface-inset p-3 space-y-2'
            >
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='space-y-0.5'>
                  <p className='text-sm font-semibold text-text-primary'>
                    {formatCarrierName(label.carrier)}
                    {shop.shippingLabels.length > 1 && (
                      <span className='ml-1 text-xs font-normal text-text-muted'>
                        (Package {idx + 1})
                      </span>
                    )}
                  </p>
                  {label.trackingNumber && (
                    <p className='text-xs text-text-secondary'>
                      {m.order_detail_tracking()}:{' '}
                      <span className='font-mono text-text-primary'>{label.trackingNumber}</span>
                    </p>
                  )}
                </div>
                {label.trackingNumber &&
                  (() => {
                    const trackingUrl = getCarrierTrackingUrl(label.carrier, label.trackingNumber)
                    if (!trackingUrl) return null
                    return (
                      <a
                        href={trackingUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-1 rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-primary/90'
                      >
                        <ExternalLink size={12} aria-hidden='true' />
                        {m.order_detail_track_package()}
                      </a>
                    )
                  })()}
              </div>
              {idx === 0 && shop.trackingStatus && (
                <div className='flex items-center gap-2'>
                  <Package size={14} aria-hidden='true' className='text-text-muted' />
                  <span
                    className={`text-xs font-medium ${trackingStatusColorClass(shop.trackingStatus)}`}
                  >
                    {formatTrackingStatus(shop.trackingStatus)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : shop.trackingNumber ? (
        <div className='rounded-lg border border-border-default bg-surface-inset p-3 space-y-2'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-xs text-text-secondary'>
              {m.order_detail_tracking()}:{' '}
              <span className='font-mono text-text-primary'>{shop.trackingNumber}</span>
            </p>
            {isValidUrl(shop.trackingUrl) && (
              <a
                href={shop.trackingUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-primary/90'
              >
                <ExternalLink size={12} aria-hidden='true' />
                {m.order_detail_track_package()}
              </a>
            )}
          </div>
        </div>
      ) : (
        !['cancelled', 'refunded', 'pending_payment', 'paid', 'delivered', 'completed'].includes(
          shop.status,
        ) && (
          <div className='rounded-lg border border-border-default bg-surface-inset p-3'>
            <p className='text-xs text-text-muted'>{m.order_detail_not_yet_shipped()}</p>
          </div>
        )
      )}
    </>
  )
}
