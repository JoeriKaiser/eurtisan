import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Package, ShippingAddress } from '#/lib/shipping-provider'
import { SendcloudError, SendcloudProvider } from './sendcloud-provider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const origin: ShippingAddress = {
  street: 'Hauptstrasse 1',
  city: 'Berlin',
  postalCode: '10115',
  country: 'DE',
}

const destination: ShippingAddress = {
  street: '1 Rue de Rivoli',
  city: 'Paris',
  postalCode: '75001',
  country: 'FR',
}

const pkg: Package = {
  weightGrams: 500,
  lengthCm: 20,
  widthCm: 15,
  heightCm: 5,
}

function makeFetch(response: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => response,
  } as Response)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SendcloudProvider', () => {
  describe('getRates', () => {
    it('returns rates mapped from Sendcloud v2 array countries and excludes unstamped letter', async () => {
      const fetchFn = makeFetch({
        shipping_methods: [
          {
            id: 8,
            name: 'Unstamped letter',
            carrier: 'sendcloud',
            min_weight: '0.001',
            max_weight: '1000.000',
            service_point_input: 'none',
            countries: [{ id: 8, iso_2: 'FR', name: 'France', price: 0, currency: 'EUR' }],
          },
          {
            id: 366,
            name: 'Colissimo Home 0.25-0.5kg',
            carrier: 'colissimo',
            min_weight: '0.251',
            max_weight: '0.501',
            service_point_input: 'none',
            countries: [{ id: 8, iso_2: 'FR', name: 'France', price: 8.94, currency: 'EUR' }],
          },
          {
            id: 372,
            name: 'Colissimo Service Point 0.25-0.5kg',
            carrier: 'colissimo',
            min_weight: '0.251',
            max_weight: '0.501',
            service_point_input: 'required',
            countries: [{ id: 8, iso_2: 'FR', name: 'France', price: 7.04, currency: 'EUR' }],
          },
        ],
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const rates = await provider.getRates(origin, destination, pkg)

      expect(rates).toHaveLength(2)
      expect(rates[0].rateId).toBe('372')
      expect(rates[0].carrier).toBe('colissimo')
      expect(rates[0].priceCents).toBe(704)
      expect(rates[0].supportsServicePoint).toBe(true)
      expect(rates[1].rateId).toBe('366')
      expect(rates[1].carrier).toBe('colissimo')
      expect(rates[1].priceCents).toBe(894)
      expect(rates[1].supportsServicePoint).toBe(false)
    })

    it('filters out methods that do not support the destination country', async () => {
      const fetchFn = makeFetch({
        shipping_methods: [
          {
            id: 123,
            name: 'PostNL Standard',
            carrier: 'PostNL',
            min_weight: '0.000',
            max_weight: '10.000',
            countries: {
              NL: { id: 1234, name: 'Netherlands', price: 6.95, currency: 'EUR' },
            },
          },
        ],
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const rates = await provider.getRates(origin, destination, pkg)
      expect(rates).toHaveLength(0)
    })

    it('filters out methods incompatible with package weight', async () => {
      const fetchFn = makeFetch({
        shipping_methods: [
          {
            id: 123,
            name: 'PostNL Standard',
            carrier: 'PostNL',
            min_weight: '0.000',
            max_weight: '0.100',
            countries: {
              FR: { id: 1234, name: 'France', price: 6.95, currency: 'EUR' },
            },
          },
        ],
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const rates = await provider.getRates(origin, destination, pkg)
      expect(rates).toHaveLength(0)
    })
  })

  describe('createLabel', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('creates a parcel and unwraps wrapped Sendcloud v2 parcel + array normal_printer response', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'false')
      const fetchFn = makeFetch({
        parcel: {
          id: 987,
          tracking_number: '3SABC1234567',
          label: {
            normal_printer: ['https://sendcloud.example.com/label-a4.pdf'],
            label_printer: 'https://sendcloud.example.com/label-thermal.pdf',
          },
          status: { message: 'Ready to send' },
        },
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const label = await provider.createLabel({
        origin,
        destination,
        package: pkg,
        carrierService: '123',
        reference: 'order-uuid-1',
      })

      expect(label.labelId).toBe('987')
      expect(label.trackingNumber).toBe('3SABC1234567')
      expect(label.labelUrl).toBe('https://sendcloud.example.com/label-thermal.pdf')
      expect(label.carrier).toBe('sendcloud')

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      const parcelCall = calls.find((call) => String(call[0]).includes('/parcels'))
      expect(parcelCall).toBeDefined()
      const requestInit = parcelCall?.[1] as { body: string }
      const body = JSON.parse(requestInit.body)
      expect(body.parcel.request_label).toBe(true)
      expect(body.parcel.shipment.id).toBe(123)
      expect(body.parcel.order_number).toBe('order-uuid-1')
      expect(body.parcel.weight).toBe('0.500')
    })

    it('includes to_service_point when pickup point is provided', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'false')
      const fetchFn = makeFetch({
        id: 987,
        tracking_number: '3SABC1234567',
        label: { normal_printer: 'https://sendcloud.example.com/label.pdf', a4_printer: null },
        status: { message: 'Label created' },
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      await provider.createLabel({
        origin,
        destination,
        package: pkg,
        carrierService: '123',
        reference: 'order-uuid-1',
        pickupPoint: {
          id: 'SP12345',
          name: 'Auchan',
          street: '25 Rue de Rivoli',
          postalCode: '75001',
          city: 'Paris',
          country: 'FR',
        },
      })

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      const parcelCall = calls.find((call) => String(call[0]).includes('/parcels'))
      expect(parcelCall).toBeDefined()
      const requestInit = parcelCall?.[1] as { body: string }
      const body = JSON.parse(requestInit.body)
      expect(body.parcel.to_service_point).toBe('SP12345')
    })

    it('sends the declared order value for customs', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'false')
      const fetchFn = makeFetch({
        id: 987,
        tracking_number: '3SABC1234567',
        label: { normal_printer: 'https://sendcloud.example.com/label.pdf', a4_printer: null },
        status: { message: 'Label created' },
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      await provider.createLabel({
        origin,
        destination,
        package: pkg,
        carrierService: '123',
        reference: 'order-uuid-1',
        declaredValueCents: 1234,
      })

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      const parcelCall = calls.find((call) => String(call[0]).includes('/parcels'))
      expect(parcelCall).toBeDefined()
      const requestInit = parcelCall?.[1] as { body: string }
      const body = JSON.parse(requestInit.body)
      expect(body.parcel.total_order_value).toBe('12.34')
      expect(body.parcel.total_order_value_currency).toBe('EUR')
    })

    it('throws SendcloudError on API failure', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'false')
      const fetchFn = makeFetch({ error: { message: 'Invalid shipment id' } }, 400)

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      await expect(
        provider.createLabel({
          origin,
          destination,
          package: pkg,
          carrierService: '123',
          reference: 'order-uuid-1',
        }),
      ).rejects.toBeInstanceOf(SendcloudError)
    })

    it('uses pinned unstamped letter method id when force unstamped letter is enabled', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'true')
      vi.stubEnv('SENDCLOUD_UNSTAMPED_LETTER_METHOD_ID', '8')

      const fetchFn = makeFetch({
        id: 987,
        tracking_number: '3SABC1234567',
        label: { normal_printer: 'https://sendcloud.example.com/label.pdf', a4_printer: null },
        status: { message: 'Label created' },
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      await provider.createLabel({
        origin,
        destination,
        package: pkg,
        carrierService: '123',
        reference: 'order-uuid-1',
      })

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      expect(calls).toHaveLength(1)
      expect(String(calls[0][0])).toContain('/parcels')
      const body = JSON.parse((calls[0][1] as { body: string }).body)
      expect(body.parcel.shipment.id).toBe(8)
    })

    it('discovers unstamped letter method when force unstamped letter is enabled and id is unset', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'true')
      vi.stubEnv('SENDCLOUD_UNSTAMPED_LETTER_METHOD_ID', '')

      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            shipping_methods: [{ id: 8, name: 'Unstamped letter', carrier: 'sendcloud' }],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            id: 987,
            tracking_number: '3SABC1234567',
            label: { normal_printer: 'https://sendcloud.example.com/label.pdf', a4_printer: null },
            status: { message: 'Label created' },
          }),
        } as Response)

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      await provider.createLabel({
        origin,
        destination,
        package: pkg,
        carrierService: '123',
        reference: 'order-uuid-1',
      })

      expect(fetchFn).toHaveBeenCalledTimes(2)
      const parcelBody = JSON.parse((fetchFn.mock.calls[1][1] as { body: string }).body)
      expect(parcelBody.parcel.shipment.id).toBe(8)
    })

    it('fails closed without creating a parcel when force unstamped letter cannot resolve a method', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'true')
      vi.stubEnv('SENDCLOUD_UNSTAMPED_LETTER_METHOD_ID', '')

      const fetchFn = makeFetch({
        shipping_methods: [{ id: 123, name: 'PostNL Standard', carrier: 'PostNL' }],
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      await expect(
        provider.createLabel({
          origin,
          destination,
          package: pkg,
          carrierService: '123',
          reference: 'order-uuid-1',
        }),
      ).rejects.toMatchObject({
        name: 'SendcloudError',
        statusCode: 503,
      })

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      expect(calls.some((call) => String(call[0]).includes('/parcels'))).toBe(false)
    })
  })

  describe('trackShipment', () => {
    it('returns tracking info mapped from Sendcloud parcels', async () => {
      const fetchFn = makeFetch({
        parcels: [
          {
            id: 987,
            tracking_number: '3SABC1234567',
            status: { message: 'Delivered' },
            status_history: [
              { message: 'Label created', timestamp: '2026-06-01T10:00:00Z' },
              { message: 'In transit', timestamp: '2026-06-02T10:00:00Z' },
              { message: 'Delivered', timestamp: '2026-06-03T10:00:00Z' },
            ],
          },
        ],
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const info = await provider.trackShipment('3SABC1234567')

      expect(info.trackingNumber).toBe('3SABC1234567')
      expect(info.status).toBe('delivered')
      expect(info.events).toHaveLength(3)
      expect(info.events[0].status).toBe('Label created')
    })
  })

  describe('getServicePoints', () => {
    it('calls servicepoints.sendcloud.sc and returns service points sorted by distance', async () => {
      const fetchFn = makeFetch([
        {
          id: 2002,
          name: 'Point 2',
          street: 'Street 2',
          postal_code: '75001',
          city: 'Paris',
          country: 'FR',
          distance: 1200,
        },
        {
          id: 1001,
          name: 'Point 1',
          street: 'Street 1',
          postal_code: '75001',
          city: 'Paris',
          country: 'FR',
          distance: 400,
        },
      ])

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const points = await provider.getServicePoints('75001', 'FR')

      expect(String((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
        'https://servicepoints.sendcloud.sc/api/v2/service-points/?',
      )
      expect(points).toHaveLength(2)
      expect(points[0].id).toBe('1001')
      expect(points[1].id).toBe('2002')
    })
  })

  describe('getServicePointMethods', () => {
    it('returns methods available for a service point', async () => {
      const fetchFn = makeFetch({
        shipping_methods: [
          {
            id: 123,
            name: 'PostNL Service Point',
            carrier: 'PostNL',
            min_weight: '0.000',
            max_weight: '10.000',
            countries: {},
          },
        ],
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const methods = await provider.getServicePointMethods('SP1')

      expect(methods).toHaveLength(1)
      expect(methods[0].rateId).toBe('123')
      expect(methods[0].supportsServicePoint).toBe(true)
    })
  })

  describe('verifyWebhookSignature', () => {
    it('returns true for a valid HMAC-SHA256 signature', async () => {
      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: makeFetch({}),
      })

      const payload = '{"parcel":{"id":1,"tracking_number":"TN"}}'
      const secret = 'secret'

      // Compute expected signature using Web Crypto API (same as provider).
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
      const expected = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      const isValid = await provider.verifyWebhookSignature(payload, expected, secret)
      expect(isValid).toBe(true)
    })

    it('returns false for an invalid signature', async () => {
      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: makeFetch({}),
      })

      const isValid = await provider.verifyWebhookSignature('payload', 'invalid', 'secret')
      expect(isValid).toBe(false)
    })
  })
})
