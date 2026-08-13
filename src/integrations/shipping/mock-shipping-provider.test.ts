import { beforeEach, describe, expect, it } from 'vitest'

import type { Package, ShippingAddress } from '#/lib/shipping-provider'
import {
  MockShippingProvider,
  mockShippingProvider,
  resetMockShippingCounter,
  type MockShippingProviderDeps,
} from './mock-shipping-provider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const berlinOrigin: ShippingAddress = {
  street: 'Hauptstrasse 1',
  city: 'Berlin',
  postalCode: '10115',
  country: 'DE',
}

const parisDestination: ShippingAddress = {
  street: '1 Rue de Rivoli',
  city: 'Paris',
  postalCode: '75001',
  country: 'FR',
}

const smallPackage: Package = {
  weightGrams: 500,
  lengthCm: 20,
  widthCm: 15,
  heightCm: 5,
}

const heavyPackage: Package = {
  weightGrams: 5000,
  lengthCm: 50,
  widthCm: 40,
  heightCm: 30,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MockShippingProvider', () => {
  beforeEach(() => {
    resetMockShippingCounter()
  })

  describe('Interface conformity', () => {
    it('implements all ShippingProvider methods', () => {
      const provider = new MockShippingProvider()

      expect(typeof provider.getRates).toBe('function')
      expect(typeof provider.createLabel).toBe('function')
      expect(typeof provider.trackShipment).toBe('function')
      expect(typeof provider.getServicePoints).toBe('function')
      expect(typeof provider.getServicePointMethods).toBe('function')
    })

    it('default singleton exists and implements the interface', () => {
      expect(mockShippingProvider).toBeInstanceOf(MockShippingProvider)
      expect(typeof mockShippingProvider.getRates).toBe('function')
      expect(typeof mockShippingProvider.createLabel).toBe('function')
      expect(typeof mockShippingProvider.trackShipment).toBe('function')
    })
  })

  describe('getRates', () => {
    it('returns two rates: standard and express', async () => {
      const provider = new MockShippingProvider()
      const rates = await provider.getRates(berlinOrigin, parisDestination, smallPackage)

      expect(rates).toHaveLength(2)

      const standard = rates[0]
      const express = rates[1]

      expect(standard.carrier).toBe('sendcloud')
      expect(standard.serviceName).toBe('Sendcloud Standard')
      expect(standard.priceCents).toBeGreaterThan(0)
      expect(standard.estimatedDays.min).toBeGreaterThan(0)
      expect(standard.estimatedDays.max).toBeGreaterThanOrEqual(standard.estimatedDays.min)
      expect(standard.supportsServicePoint).toBe(true)

      expect(express.carrier).toBe('sendcloud')
      expect(express.serviceName).toBe('Sendcloud Express')
      expect(express.priceCents).toBeGreaterThan(standard.priceCents)
      expect(express.estimatedDays.min).toBeLessThanOrEqual(standard.estimatedDays.min)
      expect(express.supportsServicePoint).toBeFalsy()
    })

    it('returns higher prices for heavier packages', async () => {
      const provider = new MockShippingProvider()

      const lightRates = await provider.getRates(berlinOrigin, parisDestination, smallPackage)
      const heavyRates = await provider.getRates(berlinOrigin, parisDestination, heavyPackage)

      expect(heavyRates[0].priceCents).toBeGreaterThan(lightRates[0].priceCents)
      expect(heavyRates[1].priceCents).toBeGreaterThan(lightRates[1].priceCents)
    })

    it('returns shorter estimated delivery for domestic shipments', async () => {
      const provider = new MockShippingProvider()

      const domesticMunich: ShippingAddress = {
        street: 'Marienplatz 1',
        city: 'München',
        postalCode: '80331',
        country: 'DE',
      }

      const domestic = await provider.getRates(berlinOrigin, domesticMunich, smallPackage)
      const international = await provider.getRates(berlinOrigin, parisDestination, smallPackage)

      expect(domestic[0].estimatedDays.max).toBeLessThanOrEqual(international[0].estimatedDays.max)
    })

    it('returns rates in ascending price order (standard first)', async () => {
      const provider = new MockShippingProvider()
      const rates = await provider.getRates(berlinOrigin, parisDestination, smallPackage)

      expect(rates[0].priceCents).toBeLessThan(rates[1].priceCents)
    })
  })

  describe('createLabel', () => {
    it('generates a label with tracking number and label URL', async () => {
      const provider = new MockShippingProvider()
      const label = await provider.createLabel({
        origin: berlinOrigin,
        destination: parisDestination,
        package: smallPackage,
        carrierService: 'sendcloud_std_test',
        reference: 'order-uuid-1',
      })

      expect(label.labelId).toMatch(/^sclbl_SC/)
      expect(label.trackingNumber).toMatch(/^SC/)
      expect(label.trackingNumber).toHaveLength(10)
      expect(label.labelUrl).toContain(label.labelId)
      expect(label.labelUrl).toMatch(/\.pdf$/)
      expect(label.carrier).toBe('sendcloud')
    })

    it('produces the same tracking number for the same inputs', async () => {
      const provider = new MockShippingProvider()
      const details = {
        origin: berlinOrigin,
        destination: parisDestination,
        package: smallPackage,
        carrierService: 'sendcloud_std_test',
        reference: 'order-uuid-2',
      }

      const label1 = await provider.createLabel(details)
      const label2 = await provider.createLabel(details)

      expect(label1.trackingNumber).toBe(label2.trackingNumber)
      expect(label1.labelId).toBe(label2.labelId)
      expect(label1.labelUrl).toBe(label2.labelUrl)
    })

    it('produces different tracking numbers for different destinations', async () => {
      const provider = new MockShippingProvider()

      const label1 = await provider.createLabel({
        origin: berlinOrigin,
        destination: parisDestination,
        package: smallPackage,
        carrierService: 'sendcloud_std_test',
      })

      const label2 = await provider.createLabel({
        origin: berlinOrigin,
        destination: {
          street: 'Kalverstraat 1',
          city: 'Amsterdam',
          postalCode: '1012 NX',
          country: 'NL',
        },
        package: smallPackage,
        carrierService: 'sendcloud_std_test',
      })

      expect(label1.trackingNumber).not.toBe(label2.trackingNumber)
    })

    it('propagates database errors instead of swallowing them', async () => {
      const failingDb = {
        insert: () => ({
          values: () => Promise.reject(new Error('DB insert failed')),
        }),
      } as unknown as NonNullable<MockShippingProviderDeps['db']>

      const provider = new MockShippingProvider({ db: failingDb })

      await expect(
        provider.createLabel({
          origin: berlinOrigin,
          destination: parisDestination,
          package: smallPackage,
          carrierService: 'sendcloud_std_test',
          reference: 'order-uuid-fail',
        }),
      ).rejects.toThrow('DB insert failed')
    })
  })

  describe('trackShipment', () => {
    it('returns tracking information with events for a given tracking number', async () => {
      const provider = new MockShippingProvider()
      const tracking = await provider.trackShipment('SCABCD1234')

      expect(tracking.trackingNumber).toBe('SCABCD1234')
      expect(tracking.carrier).toBe('sendcloud')
      expect(tracking.estimatedDelivery).toBeTruthy()
      expect(tracking.events.length).toBeGreaterThanOrEqual(4)

      for (let i = 1; i < tracking.events.length; i++) {
        expect(new Date(tracking.events[i].timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(tracking.events[i - 1].timestamp).getTime(),
        )
      }
    })

    it('returns the correct final status ("delivered")', async () => {
      const provider = new MockShippingProvider()
      const tracking = await provider.trackShipment('SCABCD1234')

      expect(tracking.status).toBe('delivered')
    })
  })

  describe('getServicePoints', () => {
    it('returns deterministic service points for a postal code and country', async () => {
      const provider = new MockShippingProvider()
      const points = await provider.getServicePoints('75001', 'FR')

      expect(points.length).toBeGreaterThan(0)
      expect(points[0]).toHaveProperty('id')
      expect(points[0]).toHaveProperty('name')
      expect(points[0]).toHaveProperty('street')
      expect(points[0].country).toBe('FR')
    })
  })

  describe('getServicePointMethods', () => {
    it('returns only methods that support service points', async () => {
      const provider = new MockShippingProvider()
      const methods = await provider.getServicePointMethods('FR-75001-01')

      expect(methods.every((m) => m.supportsServicePoint)).toBe(true)
      expect(methods.length).toBe(1)
      expect(methods[0]?.serviceName).toBe('Sendcloud Standard')
    })
  })
})
