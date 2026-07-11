import '@tanstack/react-start/server-only'

/**
 * Mock shipping provider for tests and local development.
 *
 * Implements the full ShippingProvider interface without making any network
 * calls. Output is deterministic so tests remain stable. Used automatically
 * in test environments and when Sendcloud credentials are not configured.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { shippingLabel } from '#/db/schema'
import type {
  Label,
  Package,
  Rate,
  ServicePoint,
  ShipmentDetails,
  ShippingAddress,
  ShippingProvider,
  TrackingEvent,
  TrackingInfo,
} from '#/lib/shipping-provider'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TRACKING_PREFIX = 'SC'

function deterministicHash(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
}

function deterministicTrackingNumber(
  country: string,
  postalCode: string,
  weightGrams: number,
): string {
  const seed = `${country}:${postalCode}:${weightGrams}`
  return `${TRACKING_PREFIX}${deterministicHash(seed)}`
}

function deterministicLabelId(trackingNumber: string): string {
  return `sclbl_${trackingNumber}`
}

function timestampOffsetHours(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString()
}

// ---------------------------------------------------------------------------
// Rate calculation
// ---------------------------------------------------------------------------

function calculateRates(
  _origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: Package,
): Rate[] {
  const weightKg = pkg.weightGrams / 1000

  const standardBase = 495
  const standardWeightCharge = Math.round(weightKg * 85)
  const standardPrice = standardBase + standardWeightCharge
  const expressPrice = Math.round(standardPrice * 1.6)

  const isIntraCountry = _origin.country === destination.country
  const standardDays = isIntraCountry ? { min: 2, max: 4 } : { min: 3, max: 7 }
  const expressDays = isIntraCountry ? { min: 1, max: 1 } : { min: 1, max: 3 }

  return [
    {
      // Use stable method identifiers so checkout selections remain valid across
      // multiple provider calls (summary fetch, service-point validation, etc.).
      rateId: 'sendcloud_std',
      carrier: 'sendcloud',
      serviceName: 'Sendcloud Standard',
      priceCents: standardPrice,
      estimatedDays: standardDays,
      supportsServicePoint: true,
    },
    {
      rateId: 'sendcloud_xpr',
      carrier: 'sendcloud',
      serviceName: 'Sendcloud Express',
      priceCents: expressPrice,
      estimatedDays: expressDays,
    },
  ]
}

// ---------------------------------------------------------------------------
// Tracking events
// ---------------------------------------------------------------------------

function buildTrackingEvents(_trackingNumber: string): TrackingEvent[] {
  const hoursAgo = 48
  const baseTime = new Date(Date.now() - hoursAgo * 3_600_000)

  function ts(hoursAfterBase: number): string {
    return new Date(baseTime.getTime() + hoursAfterBase * 3_600_000).toISOString()
  }

  return [
    {
      timestamp: ts(0),
      status: 'label_created',
      location: 'Sendcloud Hub — Lille, FR',
    },
    {
      timestamp: ts(4),
      status: 'Shipment picked up by carrier',
      location: 'Sendcloud Hub — Lille, FR',
    },
    {
      timestamp: ts(8),
      status: 'Package received at sorting centre',
      location: 'Sendcloud Sorting — Paris, FR',
    },
    {
      timestamp: ts(16),
      status: 'in_transit',
      location: 'In transit to destination',
    },
    {
      timestamp: ts(28),
      status: 'Package arrived at local depot',
      location: 'Local delivery depot',
    },
    {
      timestamp: ts(36),
      status: 'out_for_delivery',
      location: 'Out for delivery with courier',
    },
    {
      timestamp: ts(44),
      status: 'delivered',
      location: 'Delivered to recipient',
    },
  ]
}

// ---------------------------------------------------------------------------
// Label generation
// ---------------------------------------------------------------------------

function buildMockLabel(trackingNumber: string, _shipmentDetails: ShipmentDetails): Label {
  const labelId = deterministicLabelId(trackingNumber)

  return {
    labelId,
    trackingNumber,
    labelUrl: `https://mock.sendcloud.example.com/labels/${labelId}.pdf`,
    carrier: 'sendcloud',
    externalParcelId: labelId,
  }
}

// ---------------------------------------------------------------------------
// Service points
// ---------------------------------------------------------------------------

function buildMockServicePoints(postalCode: string, country: string): ServicePoint[] {
  const cleanPc = (postalCode || '75001').trim()
  const cleanCountry = (country || 'FR').toUpperCase()

  if (cleanCountry === 'DE') {
    return [
      {
        id: `DE-${cleanPc}-01`,
        name: 'Packstation - Edeka',
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
      name: 'Relay Pick-up - Auchan',
      street: '25 Rue de Rivoli',
      postalCode: cleanPc,
      city: 'Paris',
      country: cleanCountry,
      distance: '0.4 km',
    },
    {
      id: `${cleanCountry}-${cleanPc}-02`,
      name: 'Épicerie du Coin',
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

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export type MockShippingProviderDeps = {
  /** Optional database instance for inserting shipping_label rows. */
  db?: PostgresJsDatabase<Record<string, never>>
}

export class MockShippingProvider implements ShippingProvider {
  private readonly db?: PostgresJsDatabase<Record<string, never>>

  constructor(deps?: MockShippingProviderDeps) {
    this.db = deps?.db
  }

  async getRates(
    origin: ShippingAddress,
    destination: ShippingAddress,
    pkg: Package,
  ): Promise<Rate[]> {
    await delay(40)
    return calculateRates(origin, destination, pkg)
  }

  async createLabel(shipmentDetails: ShipmentDetails): Promise<Label> {
    await delay(60)

    const trackingNumber = deterministicTrackingNumber(
      shipmentDetails.destination.country,
      shipmentDetails.destination.postalCode,
      shipmentDetails.package.weightGrams,
    )

    const label = buildMockLabel(trackingNumber, shipmentDetails)

    if (this.db && shipmentDetails.reference) {
      await this.db.insert(shippingLabel).values({
        shopOrderId: shipmentDetails.reference,
        carrier: label.carrier,
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        externalParcelId: label.externalParcelId ?? null,
      })
    }

    return label
  }

  async trackShipment(trackingNumber: string): Promise<TrackingInfo> {
    await delay(30)

    const events = buildTrackingEvents(trackingNumber)
    const latestEvent = events[events.length - 1]

    return {
      trackingNumber,
      carrier: 'sendcloud',
      status: latestEvent.status,
      estimatedDelivery: timestampOffsetHours(2),
      events,
    }
  }

  async getServicePoints(postalCode: string, country: string): Promise<ServicePoint[]> {
    await delay(50)
    return buildMockServicePoints(postalCode, country)
  }

  async getServicePointMethods(_servicePointId: string): Promise<Rate[]> {
    await delay(40)
    // Return the same stable method identifiers as getRates so checkout
    // validation can match the buyer's selected shipping method.
    return [
      {
        rateId: 'sendcloud_std',
        carrier: 'sendcloud',
        serviceName: 'Sendcloud Standard',
        priceCents: 0,
        estimatedDays: { min: 2, max: 7 },
        supportsServicePoint: true,
      },
    ]
  }
}

/** Default mock shipping provider instance used by the application. */
export const mockShippingProvider = new MockShippingProvider()

/**
 * No-op: mock rates are now deterministic per input, so no counter needs resetting.
 * Kept for backward compatibility with existing tests.
 */
export function resetMockShippingCounter(): void {
  // intentionally empty
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
