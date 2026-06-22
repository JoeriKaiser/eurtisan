/**
 * Sendcloud shipping provider.
 *
 * Implements the ShippingProvider interface using Sendcloud API v2.
 * Supports live rates, label creation, tracking, service points, and webhook
 * signature verification.
 *
 * Environment safety:
 * - In non-production environments label creation is forced to the
 *   "Unstamped letter" method so no paid carrier labels are created.
 * - If SENDCLOUD_UNSTAMPED_LETTER_METHOD_ID is not set, the provider discovers
 *   the method ID at runtime and caches it for the process lifetime.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { shippingLabel } from '#/db/schema'
import {
  getSendcloudForceUnstampedLetter,
  getSendcloudPublicKey,
  getSendcloudSecretKey,
  getSendcloudUnstampedLetterMethodId,
} from '#/lib/env.server'
import { logger } from '#/lib/logger.server'
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
// Types
// ---------------------------------------------------------------------------

export interface SendcloudProviderDeps {
  /** Optional fetch implementation for testability. */
  fetch?: typeof fetch
  /** Optional database instance for inserting shipping_label rows. */
  db?: PostgresJsDatabase<Record<string, never>>
  /** Optional public key override. */
  publicKey?: string
  /** Optional secret key override. */
  secretKey?: string
}

export class SendcloudError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly sendcloudMessage?: string,
  ) {
    super(message)
    this.name = 'SendcloudError'
  }
}

interface SendcloudShippingMethod {
  id: number
  name: string
  carrier: string
  min_weight: string
  max_weight: string
  countries: Record<
    string,
    {
      id: number
      name: string
      price: number
      currency: string
    }
  >
}

interface SendcloudParcel {
  id: number
  tracking_number: string
  label: {
    normal_printer: string | null
    a4_printer: string | null
  }
  status: {
    message: string
  }
}

interface SendcloudServicePoint {
  id: string
  name: string
  street: string
  house_number?: string
  postal_code: string
  city: string
  country: string
  distance?: string
  carrier?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SENDCLOUD_API_BASE = 'https://panel.sendcloud.sc/api/v2'
const REQUEST_TIMEOUT_MS = 15_000

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class SendcloudProvider implements ShippingProvider {
  private readonly publicKey: string | undefined
  private readonly secretKey: string | undefined
  private readonly fetchFn: typeof fetch
  private readonly db?: PostgresJsDatabase<Record<string, never>>
  private unstampedLetterMethodId: number | undefined

  constructor(deps?: SendcloudProviderDeps) {
    this.publicKey = deps?.publicKey ?? getSendcloudPublicKey()
    this.secretKey = deps?.secretKey ?? getSendcloudSecretKey()
    this.fetchFn = deps?.fetch ?? fetch
    this.db = deps?.db
    this.unstampedLetterMethodId = getSendcloudUnstampedLetterMethodId()
  }

  // -----------------------------------------------------------------------
  // getRates
  // -----------------------------------------------------------------------

  async getRates(
    _origin: ShippingAddress,
    destination: ShippingAddress,
    pkg: Package,
  ): Promise<Rate[]> {
    const methods = await this.listShippingMethods()
    const weightKg = pkg.weightGrams / 1000
    const destinationCountry = destination.country.toUpperCase()

    const rates: Rate[] = []

    for (const method of methods) {
      const minWeight = Number.parseFloat(method.min_weight)
      const maxWeight = Number.parseFloat(method.max_weight)

      if (Number.isNaN(minWeight) || Number.isNaN(maxWeight)) continue
      if (weightKg < minWeight || weightKg > maxWeight) continue

      const countryRate = method.countries[destinationCountry]
      if (!countryRate) continue

      const priceCents = Math.round(countryRate.price * 100)

      rates.push({
        rateId: String(method.id),
        carrier: method.carrier.toLowerCase().replace(/\s+/g, '_'),
        serviceName: method.name,
        priceCents,
        estimatedDays: { min: 2, max: 7 }, // Sendcloud does not expose this per method in v2; use conservative defaults.
        // Service-point support is validated per point via getServicePointMethods.
        // We mark methods as potentially supporting service points so the UI shows
        // the selector; incompatibility is caught when a point is selected.
        supportsServicePoint: true,
      })
    }

    rates.sort((a, b) => a.priceCents - b.priceCents)
    return rates
  }

  // -----------------------------------------------------------------------
  // createLabel
  // -----------------------------------------------------------------------

  async createLabel(shipmentDetails: ShipmentDetails): Promise<Label> {
    const effectiveMethodId = await this.resolveShippingMethodId(shipmentDetails.carrierService)

    const body = this.buildParcelPayload(shipmentDetails, effectiveMethodId)

    const response = await this.request<SendcloudParcel>('POST', '/parcels', body)

    const parcel = response
    const labelUrl = parcel.label.a4_printer ?? parcel.label.normal_printer ?? ''
    const carrier = shipmentDetails.pickupPoint?.carrier ?? 'sendcloud'

    if (this.db && shipmentDetails.reference) {
      await this.db.insert(shippingLabel).values({
        shopOrderId: shipmentDetails.reference,
        carrier,
        trackingNumber: parcel.tracking_number,
        labelUrl,
        externalParcelId: String(parcel.id),
      })
    }

    return {
      labelId: String(parcel.id),
      trackingNumber: parcel.tracking_number,
      labelUrl,
      carrier,
      externalParcelId: String(parcel.id),
    }
  }

  // -----------------------------------------------------------------------
  // trackShipment
  // -----------------------------------------------------------------------

  async trackShipment(trackingNumber: string): Promise<TrackingInfo> {
    interface ParcelsResponse {
      parcels: Array<{
        id: number
        tracking_number: string
        status: { message: string }
        status_history?: Array<{
          message: string
          timestamp: string
        }>
      }>
    }

    const response = await this.request<ParcelsResponse>(
      'GET',
      `/parcels?tracking_number=${encodeURIComponent(trackingNumber)}`,
    )

    const parcel = response.parcels?.[0]
    if (!parcel) {
      throw new SendcloudError(`Parcel not found for tracking number ${trackingNumber}`, 404)
    }

    const events: TrackingEvent[] =
      parcel.status_history?.map((h) => ({
        timestamp: h.timestamp,
        status: h.message,
      })) ?? []

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return {
      trackingNumber: parcel.tracking_number,
      carrier: 'sendcloud',
      status: this.mapSendcloudStatus(parcel.status.message),
      events,
    }
  }

  // -----------------------------------------------------------------------
  // getServicePoints
  // -----------------------------------------------------------------------

  async getServicePoints(
    postalCode: string,
    country: string,
    carrier?: string,
  ): Promise<ServicePoint[]> {
    const params = new URLSearchParams({
      postal_code: postalCode,
      country: country.toUpperCase(),
    })
    if (carrier) {
      params.set('carrier', carrier)
    }

    interface ServicePointsResponse {
      service_points: SendcloudServicePoint[]
    }

    const response = await this.request<ServicePointsResponse>(
      'GET',
      `/service-points?${params.toString()}`,
    )

    const points = response.service_points ?? []
    points.sort((a, b) => {
      const distA = a.distance ? Number.parseFloat(a.distance) : Number.POSITIVE_INFINITY
      const distB = b.distance ? Number.parseFloat(b.distance) : Number.POSITIVE_INFINITY
      return distA - distB
    })

    return points.map((p) => ({
      id: p.id,
      name: p.name,
      street: [p.street, p.house_number].filter(Boolean).join(' '),
      postalCode: p.postal_code,
      city: p.city,
      country: p.country,
      distance: p.distance,
      carrier: p.carrier,
    }))
  }

  // -----------------------------------------------------------------------
  // getServicePointMethods
  // -----------------------------------------------------------------------

  async getServicePointMethods(servicePointId: string): Promise<Rate[]> {
    const methods = await this.listShippingMethods(servicePointId)
    const rates: Rate[] = []

    for (const method of methods) {
      rates.push({
        rateId: String(method.id),
        carrier: method.carrier.toLowerCase().replace(/\s+/g, '_'),
        serviceName: method.name,
        priceCents: 0, // Pricing is calculated per destination in getRates.
        estimatedDays: { min: 2, max: 7 },
        supportsServicePoint: true,
      })
    }

    return rates
  }

  // -----------------------------------------------------------------------
  // Webhook signature verification
  // -----------------------------------------------------------------------

  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    const expected = await this.hmacSha256(payload, secret)
    if (expected.length !== signature.length) return false

    let result = 0
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return result === 0
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private async resolveShippingMethodId(selectedRateId: string): Promise<number> {
    const forceUnstamped = getSendcloudForceUnstampedLetter()

    if (forceUnstamped) {
      const id = await this.getUnstampedLetterMethodId()
      if (id) return id
      logger.warn(
        'SendcloudProvider: Unstamped letter method not found and force is enabled. Falling back to selected method.',
      )
    }

    const numericId = Number.parseInt(selectedRateId, 10)
    if (!Number.isNaN(numericId) && numericId > 0) {
      return numericId
    }

    throw new SendcloudError(`Invalid Sendcloud shipping method id: ${selectedRateId}`, 400)
  }

  private async getUnstampedLetterMethodId(): Promise<number | undefined> {
    if (this.unstampedLetterMethodId) {
      return this.unstampedLetterMethodId
    }

    const configured = getSendcloudUnstampedLetterMethodId()
    if (configured) {
      this.unstampedLetterMethodId = configured
      return configured
    }

    try {
      const methods = await this.listShippingMethods()
      const method = methods.find((m) => m.name.toLowerCase().includes('unstamped letter'))
      if (method) {
        this.unstampedLetterMethodId = method.id
        return method.id
      }
    } catch (err) {
      logger.error('SendcloudProvider: failed to discover Unstamped letter method', err)
    }

    return undefined
  }

  private async listShippingMethods(servicePointId?: string): Promise<SendcloudShippingMethod[]> {
    interface MethodsResponse {
      shipping_methods: SendcloudShippingMethod[]
    }

    const params = servicePointId ? `?service_point_id=${encodeURIComponent(servicePointId)}` : ''
    const response = await this.request<MethodsResponse>('GET', `/shipping_methods${params}`)
    return response.shipping_methods ?? []
  }

  private buildParcelPayload(details: ShipmentDetails, methodId: number): Record<string, unknown> {
    const { destination, package: pkg, reference, pickupPoint } = details

    const declaredValueCents = details.declaredValueCents ?? 0
    const totalOrderValue = (declaredValueCents / 100).toFixed(2)

    const parcel: Record<string, unknown> = {
      name: destination.company ?? 'Recipient',
      company_name: destination.company ?? '',
      address: destination.street,
      city: destination.city,
      postal_code: destination.postalCode,
      country: destination.country.toUpperCase(),
      request_label: true,
      shipment: { id: methodId },
      weight: (pkg.weightGrams / 1000).toFixed(3),
      order_number: reference ?? '',
      total_order_value_currency: 'EUR',
      total_order_value: totalOrderValue,
    }

    if (pickupPoint) {
      parcel.to_service_point = pickupPoint.id
    }

    return { parcel }
  }

  private mapSendcloudStatus(message: string): string {
    const normalized = message.toLowerCase()
    if (normalized.includes('delivered')) return 'delivered'
    if (normalized.includes('out for delivery')) return 'out_for_delivery'
    if (normalized.includes('transit')) return 'in_transit'
    if (normalized.includes('registered') || normalized.includes('label created'))
      return 'registered'
    return normalized
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.publicKey || !this.secretKey) {
      throw new SendcloudError(
        'Sendcloud credentials are not configured. Set SENDCLOUD_PUBLIC_KEY and SENDCLOUD_SECRET_KEY.',
        500,
      )
    }

    const auth = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64')
    const url = `${SENDCLOUD_API_BASE}${path}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await this.fetchFn(url, {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      if (!response.ok) {
        let sendcloudMessage: string | undefined
        try {
          const errorBody = (await response.json()) as { error?: { message?: string } }
          sendcloudMessage = errorBody.error?.message
        } catch {
          // Ignore parse errors; fall back to status text.
        }

        throw new SendcloudError(
          `Sendcloud API error: ${response.statusText}`,
          response.status,
          sendcloudMessage,
        )
      }

      return (await response.json()) as T
    } catch (err) {
      if (err instanceof SendcloudError) throw err

      if (err instanceof Error && err.name === 'AbortError') {
        throw new SendcloudError('Sendcloud API request timed out', 504)
      }

      logger.error('SendcloudProvider request failed', err, { path })
      throw new SendcloudError(err instanceof Error ? err.message : 'Sendcloud request failed', 500)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private async hmacSha256(message: string, secret: string): Promise<string> {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const msg = encoder.encode(message)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msg)

    const bytes = new Uint8Array(signature)
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

/** Default Sendcloud shipping provider instance used by the application. */
export const sendcloudProvider = new SendcloudProvider()
