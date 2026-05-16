/**
 * Mondial Relay shipping provider — mock implementation.
 *
 * All API calls are mocked with realistic but deterministic responses for
 * development. Uses MONDIAL_RELAY_API_KEY for configuration; degrades
 * gracefully when the key is missing so the full shipping flow (get rates →
 * create label → track shipment) works end-to-end in development.
 *
 * Mock data is deterministic: the same inputs always produce the same
 * tracking numbers and rates for testability.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { shippingLabel } from '#/db/schema'
import type {
  Label,
  Package,
  Rate,
  ShipmentDetails,
  ShippingAddress,
  ShippingProvider,
  TrackingEvent,
  TrackingInfo,
} from '#/lib/shipping-provider'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic tracking number prefix. */
const TRACKING_PREFIX = 'MR'

let _mockCounter = 0

/**
 * Generate a deterministic tracking number from the destination country,
 * postal code, and package weight. The same inputs always produce the same
 * tracking number.
 */
function deterministicTrackingNumber(
  country: string,
  postalCode: string,
  weightGrams: number,
): string {
  const seed = `${country}:${postalCode}:${weightGrams}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  const suffix = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
  return `${TRACKING_PREFIX}${suffix}`
}

/**
 * Generate a deterministic label ID.
 */
function deterministicLabelId(trackingNumber: string): string {
  return `mrlbl_${trackingNumber}`
}

/**
 * Build a pseudo ISO-8601 timestamp offset from now by the given number of hours.
 */
function timestampOffsetHours(offsetHours: number): string {
  const d = new Date(Date.now() + offsetHours * 3_600_000)
  return d.toISOString()
}

/**
 * Resets the mock counter so tests are deterministic.
 */
export function resetMockShippingCounter(): void {
  _mockCounter = 0
}

// ---------------------------------------------------------------------------
// Rate calculation (mock)
// ---------------------------------------------------------------------------

/** Base EUR rates for standard and express shipping within Europe. */
function calculateRates(
  _origin: ShippingAddress,
  destination: ShippingAddress,
  pkg: Package,
): Rate[] {
  _mockCounter += 1

  const weightKg = pkg.weightGrams / 1000
  const volumeCm3 = pkg.lengthCm * pkg.widthCm * pkg.heightCm

  // Base standard rate: €4.95 + weight surcharge
  const standardBase = 495
  const standardWeightCharge = Math.round(weightKg * 85) // €0.85/kg
  const standardPrice = standardBase + standardWeightCharge

  // Express rate: roughly 1.6× standard with faster delivery
  const expressPrice = Math.round(standardPrice * 1.6)

  // Delivery estimates based on destination
  const isIntraCountry = _origin.country === destination.country
  const standardDays = isIntraCountry ? { min: 2, max: 4 } : { min: 3, max: 7 }
  const expressDays = isIntraCountry ? { min: 1, max: 1 } : { min: 1, max: 3 }

  const rateId = deterministicTrackingNumber(
    destination.country,
    destination.postalCode,
    Math.round(weightKg * 1000) + volumeCm3,
  )

  return [
    {
      rateId: `mondial_std_${rateId}`,
      carrier: 'mondial_relay',
      serviceName: 'Mondial Relay Standard',
      priceCents: standardPrice,
      estimatedDays: standardDays,
    },
    {
      rateId: `mondial_xpr_${rateId}`,
      carrier: 'mondial_relay',
      serviceName: 'Mondial Relay Express',
      priceCents: expressPrice,
      estimatedDays: expressDays,
    },
  ]
}

// ---------------------------------------------------------------------------
// Tracking events (mock)
// ---------------------------------------------------------------------------

/** Generate a realistic tracking timeline for a shipment. */
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
      location: 'Mondial Relay Hub — Lille, FR',
    },
    {
      timestamp: ts(4),
      status: 'Shipment picked up by carrier',
      location: 'Mondial Relay Hub — Lille, FR',
    },
    {
      timestamp: ts(8),
      status: 'Package received at sorting centre',
      location: 'Mondial Relay Sorting — Paris, FR',
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
// Label generation (mock)
// ---------------------------------------------------------------------------

function buildMockLabel(trackingNumber: string, _shipmentDetails: ShipmentDetails): Label {
  const labelId = deterministicLabelId(trackingNumber)

  return {
    labelId,
    trackingNumber,
    labelUrl: `https://mock.mondialrelay.example.com/labels/${labelId}.pdf`,
    carrier: 'mondial_relay',
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export type MondialRelayProviderDeps = {
  /** Optional database instance for inserting shipping_label rows. */
  db?: PostgresJsDatabase<Record<string, never>>
}

export class MondialRelayProvider implements ShippingProvider {
  private readonly apiKey: string | undefined
  private readonly db?: PostgresJsDatabase<Record<string, never>>

  constructor(deps?: MondialRelayProviderDeps) {
    this.apiKey = process.env.MONDIAL_RELAY_API_KEY
    this.db = deps?.db

    if (!this.apiKey) {
      // Operating in mock mode without a configured API key. This is expected
      // in development. The provider continues to serve deterministic mock
      // data so the full shipping flow remains functional.
      console.warn(
        'MondialRelayProvider: MONDIAL_RELAY_API_KEY is not set. ' +
          'All shipping calls will use mock data.',
      )
    }
  }

  // -----------------------------------------------------------------------
  // getRates
  // -----------------------------------------------------------------------

  async getRates(
    origin: ShippingAddress,
    destination: ShippingAddress,
    pkg: Package,
  ): Promise<Rate[]> {
    // Simulate network latency
    await delay(40)

    return calculateRates(origin, destination, pkg)
  }

  // -----------------------------------------------------------------------
  // createLabel
  // -----------------------------------------------------------------------

  async createLabel(shipmentDetails: ShipmentDetails): Promise<Label> {
    await delay(60)

    const trackingNumber = deterministicTrackingNumber(
      shipmentDetails.destination.country,
      shipmentDetails.destination.postalCode,
      shipmentDetails.package.weightGrams,
    )

    const label = buildMockLabel(trackingNumber, shipmentDetails)

    // Insert a shipping_label row when a database instance is available and a
    // shop order reference is provided.
    if (this.db && shipmentDetails.reference) {
      try {
        await this.db.insert(shippingLabel).values({
          shopOrderId: shipmentDetails.reference,
          carrier: label.carrier,
          trackingNumber: label.trackingNumber,
          labelUrl: label.labelUrl,
        })
      } catch (err) {
        // Log the error but do not fail the label creation. The caller
        // still receives the label so the checkout flow can continue.
        console.error(
          'MondialRelayProvider: failed to insert shipping_label row:',
          err instanceof Error ? err.message : err,
        )
      }
    }

    return label
  }

  // -----------------------------------------------------------------------
  // trackShipment
  // -----------------------------------------------------------------------

  async trackShipment(trackingNumber: string): Promise<TrackingInfo> {
    await delay(30)

    const events = buildTrackingEvents(trackingNumber)
    const latestEvent = events[events.length - 1]

    return {
      trackingNumber,
      carrier: 'mondial_relay',
      status: latestEvent.status,
      estimatedDelivery: timestampOffsetHours(2),
      events,
    }
  }
}

// ---------------------------------------------------------------------------
// Default singleton
// ---------------------------------------------------------------------------

/** Default Mondial Relay shipping provider instance used by the application. */
export const mondialRelayProvider = new MondialRelayProvider()

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
