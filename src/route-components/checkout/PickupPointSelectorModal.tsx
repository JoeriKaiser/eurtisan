import { useState } from 'react'
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
import { getServicePoints } from '#/lib/checkout'
import { m } from '#/paraglide/messages'

export interface ServicePoint {
  id: string
  name: string
  street: string
  postalCode: string
  city: string
  country: string
  distance?: string
}

interface PickupPointSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postalCode: string
  country: string
  carrier?: string
  onSelect: (point: ServicePoint) => void
}

export function PickupPointSelectorModal({
  open,
  onOpenChange,
  postalCode: initialPostalCode,
  country: initialCountry,
  carrier,
  onSelect,
}: PickupPointSelectorModalProps) {
  const [searchPostalCode, setSearchPostalCode] = useState(initialPostalCode)
  const [searchCountry, setSearchCountry] = useState(initialCountry)
  const [points, setPoints] = useState<ServicePoint[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSearching(true)
    setError(null)
    setHasSearched(false)

    try {
      const results = await getServicePoints({
        data: {
          postalCode: searchPostalCode,
          country: searchCountry,
          carrier,
        },
      })
      setPoints(results)
    } catch {
      setError(m.pickup_load_error())
      setPoints([])
    } finally {
      setHasSearched(true)
      setIsSearching(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='w-full max-w-lg'>
            <DialogTitle className='text-lg font-semibold text-text-primary mb-2'>
              {m.checkout_pickup_point_select()}
            </DialogTitle>
            <DialogDescription className='text-sm text-text-secondary mb-4'>
              {m.pickup_description()}
            </DialogDescription>

            <form onSubmit={handleSearch} className='flex gap-3 mb-6'>
              <div className='flex-1 grid gap-1.5'>
                <label
                  htmlFor='pickup-search-postal-code'
                  className='text-sm font-medium text-text-primary'
                >
                  {m.checkout_field_postal_code()}
                </label>
                <Input
                  id='pickup-search-postal-code'
                  value={searchPostalCode}
                  onChange={(e) => setSearchPostalCode(e.target.value)}
                  placeholder='75001'
                  className='h-10'
                  required
                />
              </div>
              <div className='w-32 grid gap-1.5'>
                <label
                  htmlFor='pickup-search-country'
                  className='text-sm font-medium text-text-primary'
                >
                  {m.checkout_field_country()}
                </label>
                <Input
                  id='pickup-search-country'
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value.toUpperCase())}
                  placeholder='FR'
                  className='h-10'
                  maxLength={2}
                  required
                />
              </div>
              <div className='flex items-end'>
                <Button type='submit' isLoading={isSearching}>
                  {m.search_button()}
                </Button>
              </div>
            </form>

            {error && (
              <p className='mb-4 text-sm text-error' role='alert'>
                {error}
              </p>
            )}

            <div className='space-y-3 max-h-72 overflow-y-auto pr-1'>
              {points.map((point) => (
                <div
                  key={point.id}
                  className='flex items-start justify-between gap-4 p-3.5 rounded-xl border border-border-default hover:border-border-strong bg-surface-default transition-colors'
                >
                  <div className='flex-1'>
                    <h4 className='text-sm font-semibold text-text-primary'>{point.name}</h4>
                    <p className='text-xs text-text-secondary mt-1'>{point.street}</p>
                    <p className='text-xs text-text-secondary'>
                      {point.postalCode} {point.city}, {point.country}
                    </p>
                    {point.distance && (
                      <span className='inline-block text-[11px] font-medium bg-bg-inset text-text-secondary px-1.5 py-0.5 rounded mt-2'>
                        {m.pickup_distance_away({ distance: point.distance })}
                      </span>
                    )}
                  </div>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => {
                      onSelect(point)
                      onOpenChange(false)
                    }}
                  >
                    {m.pickup_select_button()}
                  </Button>
                </div>
              ))}

              {hasSearched && points.length === 0 && !error && (
                <p className='text-sm text-text-muted italic text-center py-6'>
                  {m.pickup_empty_results()}
                </p>
              )}

              {!hasSearched && (
                <p className='text-sm text-text-muted italic text-center py-6'>
                  {m.pickup_search_hint()}
                </p>
              )}
            </div>

            <div className='mt-6 flex justify-end'>
              <Button variant='ghost' onClick={() => onOpenChange(false)}>
                {m.confirm_dialog_cancel()}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      )}
    </Dialog>
  )
}
