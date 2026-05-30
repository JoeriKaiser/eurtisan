import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ImageOff,
  MapPin,
  Package,
  Truck,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { isSupportedShippingCountry } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { ShopOrderStatusTimeline } from '#/route-components/studio/ShopOrderStatusTimeline'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Buyer {
  name: string
  email: string
}

interface ShippingAddress {
  name: string
  street: string
  city: string
  postalCode: string
  country: string
  pickupPoint?: {
    id: string
    name: string
    street: string
    postalCode: string
    city: string
    country: string
  } | null
}

interface Label {
  carrier: string
  trackingNumber?: string | null
  labelUrl?: string | null
}

interface OrderItem {
  id: string
  productName: string
  unitPriceCents: number
  quantity: number
  totalCents: number
  vatRateBasisPoints: number
  vatAmountCents: number
}

interface OrderTotals {
  subtotalCents: number
  shippingCostCents: number
  vatAmountCents: number
  shippingVatAmountCents: number
  shippingVatRateBasisPoints: number
}

/* ------------------------------------------------------------------ */
/*  OrderStatusSection                                               */
/* ------------------------------------------------------------------ */

interface OrderStatusSectionProps {
  status: string
  canShip: boolean
  canDeliver: boolean
  isMarkingDelivered: boolean
  onShip: () => void
  onMarkDelivered: () => void
}

export function OrderStatusSection({
  status,
  canShip,
  canDeliver,
  isMarkingDelivered,
  onShip,
  onMarkDelivered,
}: OrderStatusSectionProps) {
  return (
    <>
      {!['cancelled', 'refunded', 'disputed'].includes(status) && (
        <Card>
          <CardContent className='pt-6'>
            <ShopOrderStatusTimeline status={status} />
          </CardContent>
        </Card>
      )}
      {(canShip || canDeliver) && (
        <div className='flex flex-wrap gap-3'>
          {canShip && (
            <Button onClick={onShip}>
              <Truck size={16} aria-hidden='true' />
              Mark as Shipped
            </Button>
          )}
          {canDeliver && (
            <Button variant='secondary' onClick={onMarkDelivered} isLoading={isMarkingDelivered}>
              <CheckCircle2 size={16} aria-hidden='true' />
              Mark as Delivered
            </Button>
          )}
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  BuyerInfoCard                                                     */
/* ------------------------------------------------------------------ */

interface BuyerInfoCardProps {
  buyer: Buyer
}

export function BuyerInfoCard({ buyer }: BuyerInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <Package size={16} className='text-text-muted' aria-hidden='true' />
          Buyer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className='text-text-primary'>{buyer.name}</p>
        <p className='text-sm text-text-secondary'>{buyer.email}</p>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  ShippingMethodCard                                                */
/* ------------------------------------------------------------------ */

interface ShippingMethodCardProps {
  shippingMethod: string
  trackingNumber: string | null
  trackingUrl: string | null
}

export function ShippingMethodCard({
  shippingMethod,
  trackingNumber,
  trackingUrl,
}: ShippingMethodCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <Truck size={16} className='text-text-muted' aria-hidden='true' />
          Shipping Method
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className='capitalize text-text-primary'>{shippingMethod}</p>
        {trackingNumber && (
          <div className='mt-2 space-y-1'>
            <p className='text-sm text-text-secondary'>Tracking: {trackingNumber}</p>
            {trackingUrl ? (
              <a
                href={trackingUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 text-sm text-accent-primary hover:underline'
              >
                Track shipment
                <Truck size={14} aria-hidden='true' />
              </a>
            ) : (
              <p className='text-sm text-text-muted'>{trackingNumber}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  ShippingLabelCard                                                 */
/* ------------------------------------------------------------------ */

interface ShippingLabelCardProps {
  label: Label
}

export function ShippingLabelCard({ label }: ShippingLabelCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <FileText size={16} className='text-text-muted' aria-hidden='true' />
          Shipping Label
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          <p className='text-sm text-text-secondary'>
            Carrier: <span className='font-medium text-text-primary'>{label.carrier}</span>
          </p>
          {label.trackingNumber && (
            <p className='text-sm text-text-secondary'>
              Tracking:{' '}
              <span className='font-medium text-text-primary'>{label.trackingNumber}</span>
            </p>
          )}
          {label.labelUrl && (
            <a
              href={label.labelUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1 text-sm text-accent-primary hover:underline'
            >
              Download / print label
              <FileText size={14} aria-hidden='true' />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  ShippingAddressCard                                               */
/* ------------------------------------------------------------------ */

interface ShippingAddressCardProps {
  address: ShippingAddress
}

export function ShippingAddressCard({ address }: ShippingAddressCardProps) {
  const countrySupported = isSupportedShippingCountry(address.country)

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <MapPin size={16} className='text-text-muted' aria-hidden='true' />
          Shipping Address
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-1'>
          <p className='text-text-primary'>{address.name}</p>
          <p className='text-text-secondary'>{address.street}</p>
          <p className='text-text-secondary'>
            {address.postalCode} {address.city}
          </p>
          <div className='flex items-center gap-2'>
            <p className='text-text-secondary'>{address.country}</p>
            {!countrySupported && (
              <span className='inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning'>
                <AlertTriangle size={12} aria-hidden='true' />
                Unsupported country
              </span>
            )}
          </div>
          {address.pickupPoint && (
            <div className='mt-3 p-3 rounded-lg border border-accent-secondary/20 bg-surface-inset not-italic'>
              <p className='text-[10px] font-bold text-accent-primary uppercase tracking-wider mb-1'>
                Mondial Relay Pick-up Point
              </p>
              <p className='font-semibold text-text-primary text-sm'>{address.pickupPoint.name}</p>
              <p className='text-xs text-text-secondary'>{address.pickupPoint.street}</p>
              <p className='text-xs text-text-secondary'>
                {address.pickupPoint.postalCode} {address.pickupPoint.city},{' '}
                {address.pickupPoint.country}
              </p>
              <p className='text-[10px] text-text-muted mt-1.5 font-mono'>
                ID: {address.pickupPoint.id}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  OrderItemsCard                                                    */
/* ------------------------------------------------------------------ */

interface OrderItemsCardProps {
  items: OrderItem[]
  totals: OrderTotals
}

export function OrderItemsCard({ items, totals }: OrderItemsCardProps) {
  const {
    subtotalCents,
    shippingCostCents,
    vatAmountCents,
    shippingVatAmountCents,
    shippingVatRateBasisPoints,
  } = totals

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm'>Items</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className='divide-y divide-border-subtle'>
          {items.map((item) => (
            <li key={item.id} className='flex items-center gap-3 py-3 first:pt-0 last:pb-0'>
              <div className='flex size-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-inset'>
                <ImageOff size={16} className='text-text-muted' aria-hidden='true' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium text-text-primary'>{item.productName}</p>
                <p className='text-xs text-text-secondary'>
                  {formatPriceEUR(item.unitPriceCents)} × {item.quantity}
                </p>
                {item.vatRateBasisPoints > 0 && (
                  <p className='text-xs text-text-muted'>
                    VAT {(item.vatRateBasisPoints / 100).toFixed(2).replace(/\.00$/, '')}%:{' '}
                    {formatPriceEUR(item.vatAmountCents)}
                  </p>
                )}
              </div>
              <span className='text-sm font-medium text-text-primary'>
                {formatPriceEUR(item.totalCents)}
              </span>
            </li>
          ))}
        </ul>
        <div className='mt-4 space-y-1 border-t border-border-default pt-4 text-sm'>
          <div className='flex justify-between text-text-secondary'>
            <span>Subtotal</span>
            <span>{formatPriceEUR(subtotalCents)}</span>
          </div>
          <div className='flex justify-between text-text-secondary'>
            <span>Shipping</span>
            <span>{formatPriceEUR(shippingCostCents)}</span>
          </div>
          {vatAmountCents > 0 && (
            <div className='flex justify-between text-text-secondary'>
              <span>Item VAT</span>
              <span>{formatPriceEUR(vatAmountCents)}</span>
            </div>
          )}
          {shippingVatAmountCents > 0 && (
            <div className='flex justify-between text-text-secondary'>
              <span>
                Shipping VAT ({(shippingVatRateBasisPoints / 100).toFixed(2).replace(/\.00$/, '')}
                %)
              </span>
              <span>{formatPriceEUR(shippingVatAmountCents)}</span>
            </div>
          )}
          {vatAmountCents > 0 || shippingVatAmountCents > 0 ? (
            <div className='flex justify-between text-text-secondary'>
              <span>Total VAT</span>
              <span>{formatPriceEUR(vatAmountCents + shippingVatAmountCents)}</span>
            </div>
          ) : null}
          <div className='flex justify-between pt-1 text-base font-semibold text-text-primary'>
            <span>Total</span>
            <span>{formatPriceEUR(subtotalCents + shippingCostCents)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
