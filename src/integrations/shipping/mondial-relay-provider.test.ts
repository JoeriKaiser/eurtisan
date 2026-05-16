import { beforeEach, describe, expect, it } from 'vitest'

import type { Package, ShippingAddress } from '#/lib/shipping-provider'
import {
  MondialRelayProvider,
  mondialRelayProvider,
  resetMockShippingCounter,
} from './mondial-relay-provider'

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

describe('MondialRelayProvider', () => {
  // Reset the mock counter before each test to keep assertions deterministic
  // regardless of test order.
  beforeEach(() => {
    resetMockShippingCounter()
  })

  // -----------------------------------------------------------------------
  // Interface conformity
  // -----------------------------------------------------------------------

  describe('Interface conformity', () => {
    it('implements all three ShippingProvider methods', () => {
      const provider = new MondialRelayProvider()

      expect(typeof provider.getRates).toBe('function')
      expect(typeof provider.createLabel).toBe('function')
      expect(typeof provider.trackShipment).toBe('function')
    })

    it('default singleton exists and implements the interface', () => {
      expect(mondialRelayProvider).toBeInstanceOf(MondialRelayProvider)
      expect(typeof mondialRelayProvider.getRates).toBe('function')
      expect(typeof mondialRelayProvider.createLabel).toBe('function')
      expect(typeof mondialRelayProvider.trackShipment).toBe('function')
    })
  })

  // -----------------------------------------------------------------------
  // getRates
  // -----------------------------------------------------------------------

  describe('getRates', () => {
    it('returns two rates: standard and express', async () => {
      const provider = new MondialRelayProvider()
      const rates = await provider.getRates(berlinOrigin, parisDestination, smallPackage)

      expect(rates).toHaveLength(2)

      const standard = rates[0]
      const express = rates[1]

      expect(standard.carrier).toBe('mondial_relay')
      expect(standard.serviceName).toBe('Mondial Relay Standard')
      expect(standard.priceCents).toBeGreaterThan(0)
      expect(standard.estimatedDays.min).toBeGreaterThan(0)
      expect(standard.estimatedDays.max).toBeGreaterThanOrEqual(standard.estimatedDays.min)

      expect(express.carrier).toBe('mondial_relay')
      expect(express.serviceName).toBe('Mondial Relay Express')
      expect(express.priceCents).toBeGreaterThan(standard.priceCents)
      expect(express.estimatedDays.min).toBeLessThanOrEqual(standard.estimatedDays.min)
    })

    it('returns higher prices for heavier packages', async () => {
      const provider = new MondialRelayProvider()

      const lightRates = await provider.getRates(berlinOrigin, parisDestination, smallPackage)
      const heavyRates = await provider.getRates(berlinOrigin, parisDestination, heavyPackage)

      expect(heavyRates[0].priceCents).toBeGreaterThan(lightRates[0].priceCents)
      expect(heavyRates[1].priceCents).toBeGreaterThan(lightRates[1].priceCents)
    })

    it('returns shorter estimated delivery for domestic shipments', async () => {
      const provider = new MondialRelayProvider()

      const domesticMunich: ShippingAddress = {
        street: 'Marienplatz 1',
        city: 'München',
        postalCode: '80331',
        country: 'DE',
      }

      const domestic = await provider.getRates(berlinOrigin, domesticMunich, smallPackage)
      const international = await provider.getRates(berlinOrigin, parisDestination, smallPackage)

      // Domestic standard delivery should be faster
      expect(domestic[0].estimatedDays.max).toBeLessThanOrEqual(international[0].estimatedDays.max)
    })

    it('returns deterministic rates for the same inputs', async () => {
      resetMockShippingCounter()
      const provider = new MondialRelayProvider()

      const rates1 = await provider.getRates(berlinOrigin, parisDestination, smallPackage)
      resetMockShippingCounter()
      const rates2 = await provider.getRates(berlinOrigin, parisDestination, smallPackage)

      expect(rates1[0].rateId).toBe(rates2[0].rateId)
      expect(rates1[0].priceCents).toBe(rates2[0].priceCents)
      expect(rates1[1].rateId).toBe(rates2[1].rateId)
      expect(rates1[1].priceCents).toBe(rates2[1].priceCents)
    })

    it('returns rates in ascending price order (standard first)', async () => {
      const provider = new MondialRelayProvider()
      const rates = await provider.getRates(berlinOrigin, parisDestination, smallPackage)

      expect(rates[0].priceCents).toBeLessThan(rates[1].priceCents)
    })
  })

  // -----------------------------------------------------------------------
  // createLabel
  // -----------------------------------------------------------------------

  describe('createLabel', () => {
    it('generates a label with tracking number and label URL', async () => {
      const provider = new MondialRelayProvider()
      const label = await provider.createLabel({
        origin: berlinOrigin,
        destination: parisDestination,
        package: smallPackage,
        carrierService: 'mondial_relay',
        reference: 'order-uuid-1',
      })

      expect(label.labelId).toMatch(/^mrlbl_MR/)
      expect(label.trackingNumber).toMatch(/^MR/)
      expect(label.trackingNumber).toHaveLength(10) // MR + 8 hex chars
      expect(label.labelUrl).toContain(label.labelId)
      expect(label.labelUrl).toMatch(/\.pdf$/)
      expect(label.carrier).toBe('mondial_relay')
    })

    it('produces the same tracking number for the same inputs', async () => {
      const provider = new MondialRelayProvider()
      const details = {
        origin: berlinOrigin,
        destination: parisDestination,
        package: smallPackage,
        carrierService: 'mondial_relay',
        reference: 'order-uuid-2',
      }

      const label1 = await provider.createLabel(details)
      const label2 = await provider.createLabel(details)

      expect(label1.trackingNumber).toBe(label2.trackingNumber)
      expect(label1.labelId).toBe(label2.labelId)
      expect(label1.labelUrl).toBe(label2.labelUrl)
    })

    it('produces different tracking numbers for different destinations', async () => {
      const provider = new MondialRelayProvider()

      const label1 = await provider.createLabel({
        origin: berlinOrigin,
        destination: parisDestination,
        package: smallPackage,
        carrierService: 'mondial_relay',
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
        carrierService: 'mondial_relay',
      })

      expect(label1.trackingNumber).not.toBe(label2.trackingNumber)
    })

    it('produces different tracking numbers for different package weights', async () => {
      const provider = new MondialRelayProvider()

      const details = (pkg: Package) => ({
        origin: berlinOrigin,
        destination: parisDestination,
        package: pkg,
        carrierService: 'mondial_relay',
      })

      const label1 = await provider.createLabel(details(smallPackage))
      const label2 = await provider.createLabel(details(heavyPackage))

      expect(label1.trackingNumber).not.toBe(label2.trackingNumber)
    })
  })

  // -----------------------------------------------------------------------
  // trackShipment
  // -----------------------------------------------------------------------

  describe('trackShipment', () => {
    it('returns tracking information with events for a given tracking number', async () => {
      const provider = new MondialRelayProvider()
      const tracking = await provider.trackShipment('MRABCD1234')

      expect(tracking.trackingNumber).toBe('MRABCD1234')
      expect(tracking.carrier).toBe('mondial_relay')
      expect(tracking.estimatedDelivery).toBeTruthy()
      expect(tracking.events.length).toBeGreaterThanOrEqual(4)

      // Events should be chronological (oldest first)
      for (let i = 1; i < tracking.events.length; i++) {
        expect(new Date(tracking.events[i].timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(tracking.events[i - 1].timestamp).getTime(),
        )
      }
    })

    it('returns the correct final status ("delivered")', async () => {
      const provider = new MondialRelayProvider()
      const tracking = await provider.trackShipment('MRABCD1234')

      expect(tracking.status).toBe('delivered')
    })

    it('includes tracking events with timestamps and locations', async () => {
      const provider = new MondialRelayProvider()
      const tracking = await provider.trackShipment('MRABCD1234')

      for (const event of tracking.events) {
        expect(event.timestamp).toBeTruthy()
        expect(event.status).toBeTruthy()
        expect(typeof event.status).toBe('string')
        expect(event.status.length).toBeGreaterThan(0)
      }
    })

    it('includes label_created, in_transit, out_for_delivery, and delivered events', async () => {
      const provider = new MondialRelayProvider()
      const tracking = await provider.trackShipment('MRABCD1234')

      const statuses = tracking.events.map((e) => e.status)
      expect(statuses).toContain('label_created')
      expect(statuses).toContain('in_transit')
      expect(statuses).toContain('out_for_delivery')
      expect(statuses).toContain('delivered')
    })

    it('returns deterministic tracking info for the same tracking number', async () => {
      const provider = new MondialRelayProvider()
      const info1 = await provider.trackShipment('MRABCD1234')
      const info2 = await provider.trackShipment('MRABCD1234')

      expect(info1.status).toBe(info2.status)
      expect(info1.events).toHaveLength(info2.events.length)
    })
  })

  // -----------------------------------------------------------------------
  // Graceful degradation
  // -----------------------------------------------------------------------

  describe('Graceful degradation', () => {
    it('works without MONDIAL_RELAY_API_KEY set', async () => {
      // Ensure the env var is unset for this test
      const originalKey = process.env.MONDIAL_RELAY_API_KEY
      delete process.env.MONDIAL_RELAY_API_KEY

      try {
        const provider = new MondialRelayProvider()

        const rates = await provider.getRates(berlinOrigin, parisDestination, smallPackage)
        expect(rates).toHaveLength(2)

        const label = await provider.createLabel({
          origin: berlinOrigin,
          destination: parisDestination,
          package: smallPackage,
          carrierService: 'mondial_relay',
        })
        expect(label.trackingNumber).toMatch(/^MR/)

        const tracking = await provider.trackShipment(label.trackingNumber)
        expect(tracking.carrier).toBe('mondial_relay')
      } finally {
        if (originalKey) {
          process.env.MONDIAL_RELAY_API_KEY = originalKey
        }
      }
    })
  })

  // -----------------------------------------------------------------------
  // Singleton / dependency injection
  // -----------------------------------------------------------------------

  describe('Singleton and DI', () => {
    it('provides a default singleton', () => {
      expect(mondialRelayProvider).toBeDefined()
      expect(mondialRelayProvider).toBeInstanceOf(MondialRelayProvider)
    })

    it('allows creating independent instances for testing', () => {
      const provider1 = new MondialRelayProvider()
      const provider2 = new MondialRelayProvider()

      // Two separate instances should both work
      expect(provider1).not.toBe(provider2)
      expect(typeof provider1.getRates).toBe('function')
      expect(typeof provider2.getRates).toBe('function')
    })
  })

  // -----------------------------------------------------------------------
  // Counter reset
  // -----------------------------------------------------------------------

  describe('resetMockShippingCounter', () => {
    it('makes mock counter deterministic across test runs', async () => {
      resetMockShippingCounter()
      const provider = new MondialRelayProvider()

      await provider.getRates(berlinOrigin, parisDestination, smallPackage)
      await provider.getRates(berlinOrigin, parisDestination, smallPackage)

      // After two calls, resetting and repeating should produce the same
      // incremental counter values (the counter affects the rateId suffix).
      resetMockShippingCounter()
      const ratesSecondRun = await provider.getRates(berlinOrigin, parisDestination, smallPackage)

      resetMockShippingCounter()
      const ratesThirdRun = await provider.getRates(berlinOrigin, parisDestination, smallPackage)

      expect(ratesSecondRun[0].rateId).toBe(ratesThirdRun[0].rateId)
      expect(ratesSecondRun[1].rateId).toBe(ratesThirdRun[1].rateId)
    })
  })
})
