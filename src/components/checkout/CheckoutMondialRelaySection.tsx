import { Truck } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { MockPickupPoint } from './PickupPointSelectorModal'

interface CheckoutMondialRelaySectionProps {
  hasMondialRelaySelection: boolean
  selectedPickupPoint: MockPickupPoint | undefined
  onOpenPicker: () => void
}

export function CheckoutMondialRelaySection({
  hasMondialRelaySelection,
  selectedPickupPoint,
  onOpenPicker,
}: CheckoutMondialRelaySectionProps) {
  if (!hasMondialRelaySelection) return null

  return (
    <section className='island-shell rounded-2xl p-4 sm:p-6 border border-accent-secondary/30 bg-surface-default shadow-sm relative overflow-hidden'>
      <div className='absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-accent-primary to-accent-secondary' />
      <div className='mb-4 flex items-center gap-2'>
        <Truck size={18} className='text-accent-primary' aria-hidden='true' />
        <h2 className='text-lg font-semibold text-text-primary'>Mondial Relay Pick-up Point</h2>
      </div>

      {selectedPickupPoint ? (
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-success/30 bg-success/5'>
          <div>
            <h3 className='text-sm font-semibold text-text-primary flex items-center gap-1.5'>
              <span className='size-2 rounded-full bg-success animate-pulse' />
              {selectedPickupPoint.name}
            </h3>
            <p className='text-xs text-text-secondary mt-1'>{selectedPickupPoint.street}</p>
            <p className='text-xs text-text-secondary'>
              {selectedPickupPoint.postalCode} {selectedPickupPoint.city},{' '}
              {selectedPickupPoint.country}
            </p>
            <span className='inline-block text-[10px] font-mono bg-bg-inset text-text-secondary px-1.5 py-0.5 rounded mt-2'>
              ID: {selectedPickupPoint.id}
            </span>
          </div>
          <Button type='button' variant='secondary' onClick={onOpenPicker}>
            Change Pick-up Point
          </Button>
        </div>
      ) : (
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-warning/30 bg-warning/5'>
          <div>
            <h3 className='text-sm font-semibold text-warning-strong'>No Pick-up Point Selected</h3>
            <p className='text-xs text-text-secondary mt-1'>
              Please choose a pick-up point location to complete your order.
            </p>
          </div>
          <Button type='button' variant='primary' onClick={onOpenPicker}>
            Select Pick-up Point
          </Button>
        </div>
      )}
    </section>
  )
}
