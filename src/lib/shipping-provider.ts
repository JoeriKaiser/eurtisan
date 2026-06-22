/**
 * Shipping provider abstraction for shipping carrier integrations.
 *
 * All monetary amounts are in euro cents (integer).
 * All measurements are in metric units (grams, centimetres).
 */

// ---------------------------------------------------------------------------
// Address & package types
// ---------------------------------------------------------------------------

/** Physical address used for origin and destination in rate requests. */
export interface ShippingAddress {
  /** Full street address including house number. */
  street: string
  /** City name. */
  city: string
  /** Postal / ZIP code. */
  postalCode: string
  /** ISO 3166-1 alpha-2 country code (e.g. "DE", "FR", "NL"). */
  country: string
  /** Optional company name or care-of. */
  company?: string
  /** Optional state or province. */
  state?: string
}

/** Package dimensions and weight for rate calculation. */
export interface Package {
  /** Weight in grams. */
  weightGrams: number
  /** Length in centimetres. */
  lengthCm: number
  /** Width in centimetres. */
  widthCm: number
  /** Height in centimetres. */
  heightCm: number
}

// ---------------------------------------------------------------------------
// Rate types
// ---------------------------------------------------------------------------

/** A shipping rate returned by a carrier. */
export interface Rate {
  /** Unique identifier for this rate within the carrier's system. */
  rateId: string
  /** Carrier identifier (e.g. "dhl", "dpd", "postnl"). */
  carrier: string
  /** Human-readable service name (e.g. "DHL Paket", "DPD Classic"). */
  serviceName: string
  /** Price in euro cents (integer). */
  priceCents: number
  /** Estimated delivery window in business days. */
  estimatedDays: {
    min: number
    max: number
  }
  /** Whether this method supports service point / pick-up delivery. */
  supportsServicePoint?: boolean
}

// ---------------------------------------------------------------------------
// Label types
// ---------------------------------------------------------------------------

/** Full shipment details required to create a shipping label. */
export interface ShipmentDetails {
  /** Origin address (sender). */
  origin: ShippingAddress
  /** Destination address (recipient). */
  destination: ShippingAddress
  /** Package dimensions and weight. */
  package: Package
  /** The carrier service to use (corresponds to Rate.carrier or Rate.rateId). */
  carrierService: string
  /** Optional reference number (e.g. shop order ID). */
  reference?: string
  /** Optional service point for pick-up delivery. */
  pickupPoint?: ServicePoint
  /**
   * Total order value in cents, used for customs declarations.
   * Providers may fall back to 0.00 when omitted.
   */
  declaredValueCents?: number
}

/** A shipping label created by a carrier. */
export interface Label {
  /** Unique identifier for this label within the carrier's system. */
  labelId: string
  /** Carrier tracking number. */
  trackingNumber: string
  /** URL to the label PDF or image. */
  labelUrl: string
  /** Carrier identifier (e.g. "dhl", "dpd", "postnl"). */
  carrier: string
  /** Carrier-specific parcel identifier used for reconciliation and webhooks. */
  externalParcelId?: string
}

// ---------------------------------------------------------------------------
// Tracking types
// ---------------------------------------------------------------------------

/** A single tracking event. */
export interface TrackingEvent {
  /** ISO 8601 timestamp of the event. */
  timestamp: string
  /** Human-readable status description (e.g. "Package received at sorting centre"). */
  status: string
  /** Optional location where the event occurred. */
  location?: string
}

/** Full tracking information for a shipment. */
export interface TrackingInfo {
  /** The tracking number this information belongs to. */
  trackingNumber: string
  /** Carrier identifier. */
  carrier: string
  /** Current shipment status (e.g. "in_transit", "delivered", "out_for_delivery"). */
  status: string
  /** Estimated delivery date (ISO 8601 date string). */
  estimatedDelivery?: string
  /** Chronological list of tracking events (oldest first). */
  events: TrackingEvent[]
}

// ---------------------------------------------------------------------------
// Service point types
// ---------------------------------------------------------------------------

/** A carrier service point / pick-up point. */
export interface ServicePoint {
  /** Unique identifier within the carrier's service point network. */
  id: string
  /** Human-readable point name (e.g. "Auchan Paris Rivoli"). */
  name: string
  /** Street address. */
  street: string
  /** Postal / ZIP code. */
  postalCode: string
  /** City. */
  city: string
  /** ISO 3166-1 alpha-2 country code. */
  country: string
  /** Optional distance string (e.g. "0.4 km"). */
  distance?: string
  /** Optional carrier operating the point. */
  carrier?: string
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * Shipping provider interface.
 *
 * Every shipping carrier integration must implement these methods.
 * The implementation is injected into order workflows so it can be swapped
 * for a mock in development or for different carriers in production.
 */
export interface ShippingProvider {
  /**
   * Get available shipping rates for a package between two addresses.
   *
   * @returns Array of available rates, sorted lowest price first.
   */
  getRates(origin: ShippingAddress, destination: ShippingAddress, pkg: Package): Promise<Rate[]>

  /**
   * Create a shipping label for a shipment.
   *
   * @returns The created label with tracking number and label URL.
   */
  createLabel(shipmentDetails: ShipmentDetails): Promise<Label>

  /**
   * Track a shipment by its tracking number.
   *
   * @returns Current tracking information including all events.
   */
  trackShipment(trackingNumber: string): Promise<TrackingInfo>

  /**
   * Find service points / pick-up points near the given postal code and country.
   *
   * @returns Array of service points, sorted by distance when available.
   */
  getServicePoints(postalCode: string, country: string, carrier?: string): Promise<ServicePoint[]>

  /**
   * Get shipping methods that support delivery to the given service point.
   */
  getServicePointMethods(servicePointId: string): Promise<Rate[]>
}
