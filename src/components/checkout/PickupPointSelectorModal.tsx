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
import { m } from '#/paraglide/messages'

export interface MockPickupPoint {
  id: string
  name: string
  street: string
  postalCode: string
  city: string
  country: string
  distance?: string
}

function getMockPickupPoints(postalCode: string, country: string): MockPickupPoint[] {
  const cleanPc = (postalCode || '75001').trim()
  const cleanCountry = (country || 'FR').toUpperCase()

  if (cleanCountry === 'DE') {
    return [
      {
        id: `DE-${cleanPc}-01`,
        name: 'Mondial Relay Schließfach - Edeka',
        street: 'Friedrichstraße 50',
        postalCode: cleanPc,
        city: 'Berlin',
        country: 'DE',
        distance: '0.2 km',
      },
      {
        id: `DE-${cleanPc}-02`,
        name: 'Späti 24 Kiosk',
        street: 'Kottbusser Damm 12',
        postalCode: cleanPc,
        city: 'Berlin',
        country: 'DE',
        distance: '0.6 km',
      },
      {
        id: `DE-${cleanPc}-03`,
        name: 'Blumenhaus Edelweiß',
        street: 'Karl-Marx-Allee 85',
        postalCode: cleanPc,
        city: 'Berlin',
        country: 'DE',
        distance: '1.1 km',
      },
    ]
  }

  return [
    {
      id: `${cleanCountry}-${cleanPc}-01`,
      name: 'Locker Mondial Relay - Auchan',
      street: '25 Rue de Rivoli',
      postalCode: cleanPc,
      city: 'Paris',
      country: cleanCountry,
      distance: '0.4 km',
    },
    {
      id: `${cleanCountry}-${cleanPc}-02`,
      name: 'Épicerie du Coin (Relais Colis)',
      street: '14 Rue Saint-Denis',
      postalCode: cleanPc,
      city: 'Paris',
      country: cleanCountry,
      distance: '0.8 km',
    },
    {
      id: `${cleanCountry}-${cleanPc}-03`,
      name: 'Pressing de la Mairie',
      street: '88 Boulevard Voltaire',
      postalCode: cleanPc,
      city: 'Paris',
      country: cleanCountry,
      distance: '1.5 km',
    },
  ]
}

interface PickupPointSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postalCode: string
  country: string
  onSelect: (point: MockPickupPoint) => void
}

export function PickupPointSelectorModal({
  open,
  onOpenChange,
  postalCode: initialPostalCode,
  country: initialCountry,
  onSelect,
}: PickupPointSelectorModalProps) {
  const [searchPostalCode, setSearchPostalCode] = useState(initialPostalCode)
  const [searchCountry, setSearchCountry] = useState(initialCountry)
  const [points, setPoints] = useState<MockPickupPoint[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const results = getMockPickupPoints(searchPostalCode, searchCountry)
    setPoints(results)
    setHasSearched(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='w-full max-w-lg'>
            <DialogTitle className='text-lg font-semibold text-text-primary mb-2'>
              Select Mondial Relay Pick-up Point
            </DialogTitle>
            <DialogDescription className='text-sm text-text-secondary mb-4'>
              Search and select a convenient parcel locker or shop for delivery.
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
                <Button type='submit'>Search</Button>
              </div>
            </form>

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
                    <span className='inline-block text-[11px] font-medium bg-bg-inset text-text-secondary px-1.5 py-0.5 rounded mt-2'>
                      {point.distance} away
                    </span>
                  </div>
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => {
                      onSelect(point)
                      onOpenChange(false)
                    }}
                  >
                    Select
                  </Button>
                </div>
              ))}

              {hasSearched && points.length === 0 && (
                <p className='text-sm text-text-muted italic text-center py-6'>
                  No pick-up points found for this area.
                </p>
              )}

              {!hasSearched && (
                <p className='text-sm text-text-muted italic text-center py-6'>
                  Enter a postal code and click search.
                </p>
              )}
            </div>

            <div className='mt-6 flex justify-end'>
              <Button variant='ghost' onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      )}
    </Dialog>
  )
}
