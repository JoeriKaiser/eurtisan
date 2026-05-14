import { describe, expect, it } from 'vitest'

import type {
  Label,
  Package,
  Rate,
  ShipmentDetails,
  ShippingAddress,
  ShippingProvider,
  TrackingEvent,
  TrackingInfo,
} from './shipping-provider'

describe('ShippingProvider types (compile-time shape check)', () => {
  // These tests validate that the exported types have the expected shape.
  // They are structural tests that verify the types compile correctly and
  // instances can be constructed as expected.

  describe('ShippingAddress', () => {
    it('can be constructed with required fields', () => {
      const address: ShippingAddress = {
        street: 'Hauptstrasse 1',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      }

      expect(address.street).toBe('Hauptstrasse 1')
      expect(address.city).toBe('Berlin')
      expect(address.postalCode).toBe('10115')
      expect(address.country).toBe('DE')
    })

    it('accepts optional company and state', () => {
      const address: ShippingAddress = {
        street: 'Dam 1',
        city: 'Amsterdam',
        postalCode: '1012 JS',
        country: 'NL',
        company: 'Eurtisan B.V.',
        state: 'Noord-Holland',
      }

      expect(address.company).toBe('Eurtisan B.V.')
      expect(address.state).toBe('Noord-Holland')
    })
  })

  describe('Package', () => {
    it('can be constructed with all dimensions', () => {
      const pkg: Package = {
        weightGrams: 1200,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 10,
      }

      expect(pkg.weightGrams).toBe(1200)
      expect(pkg.lengthCm).toBe(30)
      expect(pkg.widthCm).toBe(20)
      expect(pkg.heightCm).toBe(10)
    })
  })

  describe('Rate', () => {
    it('can be constructed with all fields', () => {
      const rate: Rate = {
        rateId: 'dhl-paket-national',
        carrier: 'dhl',
        serviceName: 'DHL Paket',
        priceCents: 499,
        estimatedDays: { min: 1, max: 2 },
      }

      expect(rate.rateId).toBe('dhl-paket-national')
      expect(rate.carrier).toBe('dhl')
      expect(rate.serviceName).toBe('DHL Paket')
      expect(rate.priceCents).toBe(499)
      expect(rate.estimatedDays.min).toBe(1)
      expect(rate.estimatedDays.max).toBe(2)
    })
  })

  describe('ShipmentDetails', () => {
    it('can be constructed with required fields', () => {
      const origin: ShippingAddress = {
        street: 'Hauptstrasse 1',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      }

      const destination: ShippingAddress = {
        street: 'Rue de la Loi 1',
        city: 'Brussels',
        postalCode: '1000',
        country: 'BE',
      }

      const pkg: Package = {
        weightGrams: 500,
        lengthCm: 20,
        widthCm: 15,
        heightCm: 5,
      }

      const details: ShipmentDetails = {
        origin,
        destination,
        package: pkg,
        carrierService: 'dhl-paket-eu',
      }

      expect(details.carrierService).toBe('dhl-paket-eu')
      expect(details.reference).toBeUndefined()
    })

    it('accepts optional reference', () => {
      const details: ShipmentDetails = {
        origin: { street: 'A', city: 'B', postalCode: 'C', country: 'DE' },
        destination: { street: 'X', city: 'Y', postalCode: 'Z', country: 'FR' },
        package: { weightGrams: 100, lengthCm: 10, widthCm: 10, heightCm: 10 },
        carrierService: 'dpd-classic',
        reference: 'order-123',
      }

      expect(details.reference).toBe('order-123')
    })
  })

  describe('Label', () => {
    it('can be constructed with all fields', () => {
      const label: Label = {
        labelId: 'lbl_abc123',
        trackingNumber: '1Z999AA10123456784',
        labelUrl: 'https://carrier.example.com/labels/lbl_abc123.pdf',
        carrier: 'dhl',
      }

      expect(label.labelId).toBe('lbl_abc123')
      expect(label.trackingNumber).toBe('1Z999AA10123456784')
      expect(label.labelUrl).toBe('https://carrier.example.com/labels/lbl_abc123.pdf')
      expect(label.carrier).toBe('dhl')
    })
  })

  describe('TrackingEvent', () => {
    it('can be constructed with required fields', () => {
      const event: TrackingEvent = {
        timestamp: '2026-05-14T10:30:00Z',
        status: 'Package received at sorting centre',
      }

      expect(event.timestamp).toBe('2026-05-14T10:30:00Z')
      expect(event.status).toBe('Package received at sorting centre')
      expect(event.location).toBeUndefined()
    })

    it('accepts optional location', () => {
      const event: TrackingEvent = {
        timestamp: '2026-05-14T14:00:00Z',
        status: 'Out for delivery',
        location: 'Berlin, DE',
      }

      expect(event.location).toBe('Berlin, DE')
    })
  })

  describe('TrackingInfo', () => {
    it('can be constructed with all fields', () => {
      const event: TrackingEvent = {
        timestamp: '2026-05-14T08:00:00Z',
        status: 'Package picked up',
        location: 'Berlin, DE',
      }

      const info: TrackingInfo = {
        trackingNumber: '1Z999AA10123456784',
        carrier: 'dhl',
        status: 'in_transit',
        estimatedDelivery: '2026-05-16',
        events: [event],
      }

      expect(info.trackingNumber).toBe('1Z999AA10123456784')
      expect(info.carrier).toBe('dhl')
      expect(info.status).toBe('in_transit')
      expect(info.estimatedDelivery).toBe('2026-05-16')
      expect(info.events).toHaveLength(1)
    })
  })

  describe('ShippingProvider interface conformity', () => {
    it('accepts a provider with all three methods', () => {
      const provider: ShippingProvider = {
        async getRates(_origin, _destination, _pkg) {
          return []
        },
        async createLabel(_details) {
          return {
            labelId: 'test',
            trackingNumber: 'test',
            labelUrl: 'https://example.com',
            carrier: 'test',
          }
        },
        async trackShipment(_trackingNumber) {
          return {
            trackingNumber: 'test',
            carrier: 'test',
            status: 'unknown',
            events: [],
          }
        },
      }

      expect(provider).toBeDefined()
      expect(typeof provider.getRates).toBe('function')
      expect(typeof provider.createLabel).toBe('function')
      expect(typeof provider.trackShipment).toBe('function')
    })
  })
})
