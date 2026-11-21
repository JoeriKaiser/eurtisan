/**
 * Real Sendcloud API v3 shipping provider.
 *
 * Implements the {@link ShippingProvider} interface using Sendcloud API v3
 * (`https://panel.sendcloud.sc/api/v3`) for shipping options, synchronous
 * shipment announcement, and parcel tracking, plus the Sendcloud Service Points
 * API (`https://servicepoints.sendcloud.sc/api/v2`) for pickup point lookup.
 *
 * Staging / dev safety:
 * - When `SENDCLOUD_FORCE_UNSTAMPED_LETTER` is enabled (true in staging/dev),
 *   `createLabel` pins the shipping option code to `sendcloud:letter` (or a
 *   validated `sendcloud:*` override from `SENDCLOUD_UNSTAMPED_LETTER_OPTION_CODE`)
 *   and fails closed rather than falling back to a paid carrier option.
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

import { shippingLabel } from '#/db/schema'
import {
  getSendcloudForceUnstampedLetter,
  getSendcloudPublicKey,
  getSendcloudSecretKey,
  getSendcloudUnstampedLetterOptionCode,
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
// Error type
// ---------------------------------------------------------------------------

export class SendcloudError extends Error {
  public readonly statusCode: number
  public readonly sendcloudMessage?: string

  constructor(message: string, statusCode = 500, sendcloudMessage?: string) {
    super(message)
    this.name = 'SendcloudError'
    this.statusCode = statusCode
    this.sendcloudMessage = sendcloudMessage
  }
}

// ---------------------------------------------------------------------------
// Dependency injection options (for testing)
// ---------------------------------------------------------------------------

export interface SendcloudProviderDeps {
  publicKey?: string
  secretKey?: string
  fetch?: typeof fetch
  db?: PostgresJsDatabase<Record<string, never>>
}

// ---------------------------------------------------------------------------
// Sendcloud API v3 & Service Points response shapes
// ---------------------------------------------------------------------------

interface SendcloudV3PriceAmount {
  value?: string | number | null
  currency?: string | null
}

interface SendcloudV3Quote {
  price?: {
    total?: SendcloudV3PriceAmount | null
  } | null
  lead_time?: number | null
}

interface SendcloudV3ShippingOption {
  code: string
  name: string
  carrier?: {
    code?: string | null
    name?: string | null
  } | null
  functionalities?: {
    last_mile?: string | null
  } | null
  requirements?: {
    is_service_point_required?: boolean | null
  } | null
  quotes?: SendcloudV3Quote[] | null
}

interface SendcloudV3ShippingOptionsResponse {
  data?: SendcloudV3ShippingOption[]
}

interface SendcloudV3ParcelDocument {
  type?: string | null
  link?: string | null
}

interface SendcloudV3AnnouncedParcel {
  id?: string | number | null
  tracking_number?: string | null
  tracking_url?: string | null
  documents?: SendcloudV3ParcelDocument[] | null
  label?: {
    normal_printer?: string | string[] | null
    label_printer?: string | null
    a4_printer?: string | null
  } | null
}

interface SendcloudV3Shipment {
  id?: string | number | null
  carrier?: {
    code?: string | null
    name?: string | null
  } | null
  parcels?: SendcloudV3AnnouncedParcel[] | null
}

type SendcloudV3AnnounceResponse = SendcloudV3Shipment | { data: SendcloudV3Shipment }

interface SendcloudV3TrackingEvent {
  timestamp?: string | null
  phase?: string | null
  exception?: string | null
  sub_status?: string | null
  description?: string | null
}

interface SendcloudV3TrackingPayload {
  tracking_numbers?: Array<{
    tracking_number?: string | null
    carrier?: string | null
  }> | null
  details?: {
    expected_delivery_date?: string | null
  } | null
  events?: SendcloudV3TrackingEvent[] | null
}

type SendcloudV3TrackingResponse =
  | SendcloudV3TrackingPayload
  | { data: SendcloudV3TrackingPayload | null }

interface SendcloudServicePoint {
  id: string | number
  name: string
  street: string
  house_number?: string
  postal_code: string
  city: string
  country: string
  distance?: string | number
  carrier?: string
}

interface SendcloudErrorBody {
  detail?: string
  error?: {
    message?: string
  }
  errors?: Array<{
    code?: string
    detail?: string
    source?: {
      pointer?: string
    }
  }>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SENDCLOUD_V3_API_BASE = 'https://panel.sendcloud.sc/api/v3'
const SENDCLOUD_SERVICE_POINTS_API_BASE = 'https://servicepoints.sendcloud.sc/api/v2'
const DEFAULT_UNSTAMPED_LETTER_OPTION_CODE = 'sendcloud:letter'
const REQUEST_TIMEOUT_MS = 15_000
const EXCLUDED_CHECKOUT_CARRIERS = new Set(['sendcloud', 'test_carrier'])
const SERVICE_POINT_LAST_MILE_MODES = new Set([
  'service_point',
  'locker',
  'locker_or_service_point',
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function splitStreetAndHouseNumber(street: string): {
  addressLine1: string
  houseNumber: string
} {
  const trimmed = street.trim()
  if (!trimmed) {
    return { addressLine1: '', houseNumber: '' }
  }

  // Leading house number (e.g. "10 Rue de Rivoli", "10bis Rue de Rivoli", "12-14 High Street")
  const leadingMatch = /^(\d+[A-Za-z0-9/-]*)\s*,?\s+(.+)$/.exec(trimmed)
  if (leadingMatch) {
    return {
      addressLine1: leadingMatch[2].trim(),
      houseNumber: leadingMatch[1].trim(),
    }
  }

  // Trailing house number (e.g. "Hauptstrasse 1", "Insulindelaan 115A", "Via Roma 12/B")
  const trailingMatch = /^(.+?)\s+(\d+[A-Za-z0-9/-]*)$/.exec(trimmed)
  if (trailingMatch) {
    return {
      addressLine1: trailingMatch[1].trim(),
      houseNumber: trailingMatch[2].trim(),
    }
  }

  return { addressLine1: trimmed, houseNumber: '' }
}

function estimateDaysFromLeadTime(leadTimeHours?: number | null): { min: number; max: number } {
  if (typeof leadTimeHours !== 'number' || !Number.isFinite(leadTimeHours) || leadTimeHours <= 0) {
    return { min: 2, max: 7 }
  }
  const minDays = Math.max(1, Math.ceil(leadTimeHours / 24))
  return { min: minDays, max: Math.max(minDays + 1, minDays) }
}

function parseQuotePriceCents(option: SendcloudV3ShippingOption): number | null {
  const raw = option.quotes?.[0]?.price?.total?.value
  if (raw === undefined || raw === null || raw === '') return null
  const parsed = typeof raw === 'number' ? raw : Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100)
}

function extractSendcloudErrorMessage(errorBody: SendcloudErrorBody): string | undefined {
  if (Array.isArray(errorBody.errors) && errorBody.errors.length > 0) {
    const parts = errorBody.errors
      .map((entry) => {
        const msg = entry.detail ?? entry.code
        if (!msg) return null
        return entry.source?.pointer ? `${entry.source.pointer}: ${msg}` : msg
      })
      .filter((entry): entry is string => Boolean(entry))
    if (parts.length > 0) {
      return parts.join('; ')
    }
  }
  if (typeof errorBody.error?.message === 'string' && errorBody.error.message.trim()) {
    return errorBody.error.message.trim()
  }
  if (typeof errorBody.detail === 'string' && errorBody.detail.trim()) {
    return errorBody.detail.trim()
  }
  return undefined
}

function extractLabelUrl(parcel?: SendcloudV3AnnouncedParcel | null): string {
  if (!parcel) return ''
  const labelDocument = parcel.documents?.find(
    (doc) => doc.type?.toLowerCase() === 'label' && typeof doc.link === 'string' && doc.link.trim(),
  )
  if (labelDocument?.link) {
    return labelDocument.link
  }

  const normalPrinterUrl = Array.isArray(parcel.label?.normal_printer)
    ? (parcel.label.normal_printer[0] ?? '')
    : (parcel.label?.normal_printer ?? '')

  return parcel.label?.a4_printer ?? parcel.label?.label_printer ?? normalPrinterUrl ?? ''
}

function mapV3TrackingStatus(event?: SendcloudV3TrackingEvent): string {
  if (!event) return 'registered'

  const phase = event.phase?.toLowerCase().trim() ?? ''
  const exception = event.exception?.toLowerCase().trim() ?? ''

  if (phase === 'delivered') return 'delivered'
  if (phase === 'returned' || exception === 'returned_to_sender') return 'returned_to_sender'
  if (
    exception &&
    exception !== 'none' &&
    ['address_error', 'not_collected', 'refused', 'delivery_failed', 'unable_to_deliver'].includes(
      exception,
    )
  ) {
    return 'unable_to_deliver'
  }
  if (phase === 'out_for_delivery') return 'out_for_delivery'
  if (phase === 'in_transit' || phase === 'ready_for_pickup') return 'in_transit'
  if (phase === 'announced') return 'registered'

  return phase || 'registered'
}

function buildV3Address(address: ShippingAddress, defaultName: string): Record<string, unknown> {
  const { addressLine1, houseNumber } = splitStreetAndHouseNumber(address.street)
  const payload: Record<string, unknown> = {
    name: address.name?.trim() || address.company?.trim() || defaultName,
    company_name: address.company?.trim() || '',
    address_line_1: addressLine1,
    postal_code: address.postalCode.trim(),
    city: address.city.trim(),
    country_code: address.country.trim().toUpperCase(),
  }

  if (houseNumber) {
    payload.house_number = houseNumber
  }
  if (address.addressLine2?.trim()) {
    payload.address_line_2 = address.addressLine2.trim()
  }
  if (address.email?.trim()) {
    payload.email = address.email.trim()
  }
  if (address.phone?.trim()) {
    payload.phone_number = address.phone.trim()
  }

  return payload
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class SendcloudProvider implements ShippingProvider {
  private readonly publicKey: string | undefined
  private readonly secretKey: string | undefined
  private readonly fetchFn: typeof fetch
  private readonly db?: PostgresJsDatabase<Record<string, never>>

  constructor(deps?: SendcloudProviderDeps) {
    this.publicKey = deps?.publicKey ?? getSendcloudPublicKey()
    this.secretKey = deps?.secretKey ?? getSendcloudSecretKey()
    this.fetchFn = deps?.fetch ?? fetch
    this.db = deps?.db
  }

  // -----------------------------------------------------------------------
  // getRates (Sendcloud API v3: POST /api/v3/shipping-options)
  // -----------------------------------------------------------------------

  async getRates(
    origin: ShippingAddress,
    destination: ShippingAddress,
    pkg: Package,
  ): Promise<Rate[]> {
    const response = await this.requestV3<SendcloudV3ShippingOptionsResponse>(
      'POST',
      '/shipping-options',
      {
        from_country_code: origin.country.trim().toUpperCase(),
        to_country_code: destination.country.trim().toUpperCase(),
        parcels: [
          {
            weight: {
              value: (pkg.weightGrams / 1000).toFixed(3),
              unit: 'kg',
            },
          },
        ],
        calculate_quotes: true,
      },
    )

    const options = response.data ?? []
    const cheapestByCode = new Map<string, Rate>()

    for (const option of options) {
      const carrierCode = option.carrier?.code?.toLowerCase().trim() ?? ''
      if (
        !option.code ||
        EXCLUDED_CHECKOUT_CARRIERS.has(carrierCode) ||
        option.name.toLowerCase().includes('unstamped letter')
      ) {
        continue
      }

      const priceCents = parseQuotePriceCents(option)
      if (priceCents === null) {
        continue
      }

      const lastMile = option.functionalities?.last_mile?.toLowerCase().trim() ?? ''
      const supportsServicePoint =
        option.requirements?.is_service_point_required === true ||
        SERVICE_POINT_LAST_MILE_MODES.has(lastMile)

      const rate: Rate = {
        rateId: option.code,
        carrier: carrierCode.replace(/\s+/g, '_') || 'sendcloud',
        serviceName: option.name,
        priceCents,
        estimatedDays: estimateDaysFromLeadTime(option.quotes?.[0]?.lead_time),
        supportsServicePoint,
      }

      const existing = cheapestByCode.get(rate.rateId)
      if (!existing || rate.priceCents < existing.priceCents) {
        cheapestByCode.set(rate.rateId, rate)
      }
    }

    const rates = Array.from(cheapestByCode.values())
    rates.sort((a, b) => a.priceCents - b.priceCents)
    return rates
  }

  // -----------------------------------------------------------------------
  // createLabel (Sendcloud API v3: POST /api/v3/shipments/announce)
  // -----------------------------------------------------------------------

  async createLabel(shipmentDetails: ShipmentDetails): Promise<Label> {
    this.validateOriginAddress(shipmentDetails.origin)
    const shippingOptionCode = this.resolveShippingOptionCode(shipmentDetails.carrierService)
    const body = this.buildAnnouncePayload(shipmentDetails, shippingOptionCode)

    const response = await this.requestV3<SendcloudV3AnnounceResponse>(
      'POST',
      '/shipments/announce',
      body,
    )

    const shipment = 'data' in response ? response.data : response
    const parcel = shipment.parcels?.[0]
    const parcelId = parcel?.id ?? shipment.id
    if (parcelId === undefined || parcelId === null || String(parcelId).trim() === '') {
      throw new SendcloudError('Sendcloud API v3 response did not include a parcel id', 502)
    }

    const externalParcelId = String(parcelId)
    const trackingNumber = parcel?.tracking_number ?? ''
    const labelUrl = extractLabelUrl(parcel)
    const carrier =
      shipment.carrier?.code?.toLowerCase().trim() ||
      shipmentDetails.pickupPoint?.carrier?.toLowerCase().trim() ||
      (shippingOptionCode.includes(':') ? shippingOptionCode.split(':')[0] : 'sendcloud')

    if (this.db && shipmentDetails.reference) {
      await this.db.insert(shippingLabel).values({
        shopOrderId: shipmentDetails.reference,
        carrier,
        trackingNumber,
        labelUrl,
        externalParcelId,
      })
    }

    return {
      labelId: externalParcelId,
      trackingNumber,
      labelUrl,
      carrier,
      externalParcelId,
    }
  }

  // -----------------------------------------------------------------------
  // trackShipment (Sendcloud API v3: GET /api/v3/parcels/tracking/{tn})
  // -----------------------------------------------------------------------

  async trackShipment(trackingNumber: string): Promise<TrackingInfo> {
    const response = await this.requestV3<SendcloudV3TrackingResponse>(
      'GET',
      `/parcels/tracking/${encodeURIComponent(trackingNumber)}`,
    )

    const payload: SendcloudV3TrackingPayload | null = 'data' in response ? response.data : response
    if (!payload) {
      throw new SendcloudError(`Parcel not found for tracking number ${trackingNumber}`, 404)
    }

    const rawEvents = payload.events ?? []
    const events: TrackingEvent[] = rawEvents
      .filter((event): event is SendcloudV3TrackingEvent & { timestamp: string } =>
        Boolean(event.timestamp),
      )
      .map((event) => ({
        timestamp: event.timestamp,
        status: event.description?.trim() || event.phase?.trim() || 'Update',
      }))

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Sendcloud v3 returns events newest-first, so pick the latest by timestamp.
    const latestEvent = [...rawEvents].sort((left, right) => {
      const leftTs = left.timestamp ? new Date(left.timestamp).getTime() : 0
      const rightTs = right.timestamp ? new Date(right.timestamp).getTime() : 0
      return rightTs - leftTs
    })[0]

    const primaryTracking = payload.tracking_numbers?.[0]

    return {
      trackingNumber: primaryTracking?.tracking_number?.trim() || trackingNumber,
      carrier: primaryTracking?.carrier?.toLowerCase().trim() || 'sendcloud',
      status: mapV3TrackingStatus(latestEvent),
      estimatedDelivery: payload.details?.expected_delivery_date ?? undefined,
      events,
    }
  }

  // -----------------------------------------------------------------------
  // getServicePoints (Sendcloud Service Points API v2)
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

    type ServicePointsResponse =
      | SendcloudServicePoint[]
      | { service_points?: SendcloudServicePoint[] }

    const response = await this.requestUrl<ServicePointsResponse>(
      'GET',
      `${SENDCLOUD_SERVICE_POINTS_API_BASE}/service-points/?${params.toString()}`,
    )

    const points = Array.isArray(response) ? response : (response.service_points ?? [])
    points.sort((a, b) => {
      const distA =
        a.distance !== undefined ? Number.parseFloat(String(a.distance)) : Number.POSITIVE_INFINITY
      const distB =
        b.distance !== undefined ? Number.parseFloat(String(b.distance)) : Number.POSITIVE_INFINITY
      return distA - distB
    })

    return points.map((p) => ({
      id: String(p.id),
      name: p.name,
      street: [p.street, p.house_number].filter(Boolean).join(' '),
      postalCode: p.postal_code,
      city: p.city,
      country: p.country,
      distance: p.distance !== undefined ? String(p.distance) : undefined,
      carrier: p.carrier,
    }))
  }

  // -----------------------------------------------------------------------
  // getServicePointMethods (Sendcloud API v3: POST /api/v3/shipping-options)
  // -----------------------------------------------------------------------

  async getServicePointMethods(servicePointId: string): Promise<Rate[]> {
    const trimmed = servicePointId.trim()
    const toServicePointId = /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : trimmed
    const response = await this.requestV3<SendcloudV3ShippingOptionsResponse>(
      'POST',
      '/shipping-options',
      {
        to_service_point_id: toServicePointId,
      },
    )

    const seen = new Set<string>()
    const rates: Rate[] = []

    for (const option of response.data ?? []) {
      const carrierCode = option.carrier?.code?.toLowerCase().trim() ?? ''
      if (
        !option.code ||
        seen.has(option.code) ||
        EXCLUDED_CHECKOUT_CARRIERS.has(carrierCode) ||
        option.name.toLowerCase().includes('unstamped letter')
      ) {
        continue
      }
      seen.add(option.code)
      rates.push({
        rateId: option.code,
        carrier: carrierCode.replace(/\s+/g, '_') || 'sendcloud',
        serviceName: option.name,
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

  private validateOriginAddress(origin: ShippingAddress): void {
    if (
      !origin.street?.trim() ||
      !origin.city?.trim() ||
      !origin.postalCode?.trim() ||
      !origin.country?.trim()
    ) {
      throw new SendcloudError(
        'Shop shipping origin address must include street, city, postal code, and country',
        400,
      )
    }
  }

  private resolveShippingOptionCode(selectedRateId: string): string {
    const forceUnstamped = getSendcloudForceUnstampedLetter()

    if (forceUnstamped) {
      const configured = getSendcloudUnstampedLetterOptionCode()
      const effectiveCode =
        configured === undefined ? DEFAULT_UNSTAMPED_LETTER_OPTION_CODE : configured
      if (!effectiveCode || !effectiveCode.toLowerCase().startsWith('sendcloud:')) {
        logger.error(
          'SendcloudProvider: invalid SENDCLOUD_UNSTAMPED_LETTER_OPTION_CODE while SENDCLOUD_FORCE_UNSTAMPED_LETTER is enabled. Refusing to fall back to selected option.',
          { configuredOptionCode: configured },
        )
        throw new SendcloudError(
          'Unstamped letter shipping option could not be resolved while SENDCLOUD_FORCE_UNSTAMPED_LETTER is enabled',
          503,
        )
      }
      return effectiveCode
    }

    const trimmed = selectedRateId.trim()
    if (!trimmed) {
      throw new SendcloudError('Sendcloud shipping option code is required', 400)
    }

    return trimmed
  }

  private buildAnnouncePayload(
    details: ShipmentDetails,
    shippingOptionCode: string,
  ): Record<string, unknown> {
    const { origin, destination, package: pkg, reference, pickupPoint } = details

    const declaredValueCents = details.declaredValueCents ?? 0
    const totalOrderValue = (declaredValueCents / 100).toFixed(2)

    const payload: Record<string, unknown> = {
      from_address: buildV3Address(origin, 'Eurtisan Seller'),
      to_address: buildV3Address(destination, 'Recipient'),
      ship_with: {
        type: 'shipping_option_code',
        properties: {
          shipping_option_code: shippingOptionCode,
        },
      },
      order_number: reference ?? '',
      total_order_price: {
        currency: 'EUR',
        value: totalOrderValue,
      },
      parcels: [
        {
          weight: {
            value: (pkg.weightGrams / 1000).toFixed(3),
            unit: 'kg',
          },
        },
      ],
    }

    if (pickupPoint) {
      payload.to_service_point = {
        id: pickupPoint.id,
      }
    }

    return payload
  }

  private async requestV3<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    return this.requestUrl<T>(method, `${SENDCLOUD_V3_API_BASE}${path}`, body)
  }

  private async requestUrl<T>(
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.publicKey || !this.secretKey) {
      throw new SendcloudError(
        'Sendcloud credentials are not configured. Set SENDCLOUD_PUBLIC_KEY and SENDCLOUD_SECRET_KEY.',
        500,
      )
    }

    const auth = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64')

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
          const errorBody = (await response.json()) as SendcloudErrorBody
          sendcloudMessage = extractSendcloudErrorMessage(errorBody)
        } catch {
          // Ignore parse errors; fall back to status text.
        }

        logger.error('SendcloudProvider API error', {
          method,
          url,
          status: response.status,
          statusText: response.statusText,
          sendcloudMessage,
        })

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

      logger.error('SendcloudProvider request failed', err, { url })
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
