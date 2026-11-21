import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Package, ShippingAddress } from '#/lib/shipping-provider'
import { SendcloudProvider, splitStreetAndHouseNumber } from './sendcloud-provider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const origin: ShippingAddress = {
  name: 'The Forge',
  company: 'The Forge',
  street: '12 Rue de la Republique',
  city: 'Lyon',
  postalCode: '69001',
  country: 'FR',
  email: 'atelier@theforge.eu',
}

const destination: ShippingAddress = {
  name: 'Staging Walkthrough',
  street: '10 Rue de Rivoli',
  city: 'Paris',
  postalCode: '75001',
  country: 'FR',
  email: 'buyer@eurtisan.eu',
  phone: '+33142685500',
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

describe('splitStreetAndHouseNumber', () => {
  it('splits leading house numbers (FR/BE/UK)', () => {
    expect(splitStreetAndHouseNumber('10 Rue de Rivoli')).toEqual({
      addressLine1: 'Rue de Rivoli',
      houseNumber: '10',
    })
    expect(splitStreetAndHouseNumber('10bis Rue de Rivoli')).toEqual({
      addressLine1: 'Rue de Rivoli',
      houseNumber: '10bis',
    })
  })

  it('splits trailing house numbers (DE/NL/AT)', () => {
    expect(splitStreetAndHouseNumber('Hauptstrasse 1')).toEqual({
      addressLine1: 'Hauptstrasse',
      houseNumber: '1',
    })
    expect(splitStreetAndHouseNumber('Insulindelaan 115A')).toEqual({
      addressLine1: 'Insulindelaan',
      houseNumber: '115A',
    })
  })

  it('keeps street intact when no house number is present', () => {
    expect(splitStreetAndHouseNumber('Place de la Concorde')).toEqual({
      addressLine1: 'Place de la Concorde',
      houseNumber: '',
    })
  })
})

describe('SendcloudProvider', () => {
  describe('getRates', () => {
    it('calls Sendcloud v3 shipping-options, excludes sendcloud/test_carrier/unpriced options, and sorts cheapest first', async () => {
      const fetchFn = makeFetch({
        data: [
          {
            code: 'sendcloud:letter',
            name: 'Unstamped letter',
            carrier: { code: 'sendcloud', name: 'Sendcloud' },
            functionalities: { last_mile: 'home_delivery' },
            requirements: { is_service_point_required: false },
            quotes: [{ price: { total: { value: '0.00', currency: 'EUR' } }, lead_time: 24 }],
          },
          {
            code: 'test_carrier:national',
            name: 'Test Carrier National Shipping Method',
            carrier: { code: 'test_carrier', name: 'Test Carrier' },
            functionalities: { last_mile: 'home_delivery' },
            requirements: { is_service_point_required: false },
            quotes: [{ price: { total: { value: '5.00', currency: 'EUR' } }, lead_time: 24 }],
          },
          {
            code: 'colissimo:home/fr',
            name: 'Colissimo Home',
            carrier: { code: 'colissimo', name: 'Colissimo' },
            functionalities: { last_mile: 'home_delivery' },
            requirements: { is_service_point_required: false },
            quotes: [{ price: { total: { value: '8.94', currency: 'EUR' } }, lead_time: 48 }],
          },
          {
            code: 'colissimo:post-office',
            name: 'Colissimo Service Point',
            carrier: { code: 'colissimo', name: 'Colissimo' },
            functionalities: { last_mile: 'locker_or_service_point' },
            requirements: { is_service_point_required: true },
            quotes: [{ price: { total: { value: '7.04', currency: 'EUR' } }, lead_time: 48 }],
          },
          {
            code: 'dpd:unpriced',
            name: 'DPD Unpriced',
            carrier: { code: 'dpd', name: 'DPD' },
            functionalities: { last_mile: 'home_delivery' },
            requirements: { is_service_point_required: false },
          },
        ],
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const rates = await provider.getRates(origin, destination, pkg)

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      expect(String(calls[0][0])).toBe('https://panel.sendcloud.sc/api/v3/shipping-options')
      const reqBody = JSON.parse((calls[0][1] as { body: string }).body)
      expect(reqBody).toEqual({
        from_country_code: 'FR',
        to_country_code: 'FR',
        parcels: [{ weight: { value: '0.500', unit: 'kg' } }],
        calculate_quotes: true,
      })

      expect(rates).toHaveLength(2)
      expect(rates[0]).toMatchObject({
        rateId: 'colissimo:post-office',
        carrier: 'colissimo',
        serviceName: 'Colissimo Service Point',
        priceCents: 704,
        estimatedDays: { min: 2, max: 3 },
        supportsServicePoint: true,
      })
      expect(rates[1]).toMatchObject({
        rateId: 'colissimo:home/fr',
        carrier: 'colissimo',
        serviceName: 'Colissimo Home',
        priceCents: 894,
        estimatedDays: { min: 2, max: 3 },
        supportsServicePoint: false,
      })
    })

    it('deduplicates repeated shipping option codes by keeping the cheapest quote', async () => {
      const fetchFn = makeFetch({
        data: [
          {
            code: 'colissimo:home/fr',
            name: 'Colissimo Home',
            carrier: { code: 'colissimo', name: 'Colissimo' },
            functionalities: { last_mile: 'home_delivery' },
            quotes: [{ price: { total: { value: '10.00', currency: 'EUR' } } }],
          },
          {
            code: 'colissimo:home/fr',
            name: 'Colissimo Home',
            carrier: { code: 'colissimo', name: 'Colissimo' },
            functionalities: { last_mile: 'home_delivery' },
            quotes: [{ price: { total: { value: '8.94', currency: 'EUR' } } }],
          },
        ],
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const rates = await provider.getRates(origin, destination, pkg)
      expect(rates).toHaveLength(1)
      expect(rates[0].priceCents).toBe(894)
    })

    it('returns empty array when Sendcloud v3 returns no options for the route', async () => {
      const fetchFn = makeFetch({ data: [] })

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

    it('announces a shipment via Sendcloud API v3 and parses documents label URL', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'false')
      const fetchFn = makeFetch({
        data: {
          id: 'shipment-uuid-1',
          carrier: { code: 'colissimo', name: 'Colissimo' },
          parcels: [
            {
              id: 987654,
              tracking_number: '3SABC1234567',
              documents: [
                {
                  type: 'label',
                  link: 'https://panel.sendcloud.sc/api/v3/parcels/987654/documents/label',
                },
              ],
            },
          ],
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
        carrierService: 'colissimo:home/fr',
        reference: 'order-uuid-1',
        declaredValueCents: 4294,
      })

      expect(label).toEqual({
        labelId: '987654',
        externalParcelId: '987654',
        trackingNumber: '3SABC1234567',
        labelUrl: 'https://panel.sendcloud.sc/api/v3/parcels/987654/documents/label',
        carrier: 'colissimo',
      })

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      expect(String(calls[0][0])).toBe('https://panel.sendcloud.sc/api/v3/shipments/announce')
      const body = JSON.parse((calls[0][1] as { body: string }).body)
      expect(body.ship_with).toEqual({
        type: 'shipping_option_code',
        properties: { shipping_option_code: 'colissimo:home/fr' },
      })
      expect(body.from_address).toMatchObject({
        name: 'The Forge',
        address_line_1: 'Rue de la Republique',
        house_number: '12',
        postal_code: '69001',
        city: 'Lyon',
        country_code: 'FR',
        email: 'atelier@theforge.eu',
      })
      expect(body.to_address).toMatchObject({
        name: 'Staging Walkthrough',
        address_line_1: 'Rue de Rivoli',
        house_number: '10',
        postal_code: '75001',
        city: 'Paris',
        country_code: 'FR',
        email: 'buyer@eurtisan.eu',
        phone_number: '+33142685500',
      })
      expect(body.order_number).toBe('order-uuid-1')
      expect(body.total_order_price).toEqual({ currency: 'EUR', value: '42.94' })
      expect(body.parcels).toEqual([{ weight: { value: '0.500', unit: 'kg' } }])
    })

    it('includes to_service_point object when pickup point is provided', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'false')
      const fetchFn = makeFetch({
        data: {
          id: 'shipment-uuid-2',
          parcels: [
            {
              id: 987,
              tracking_number: '3SABC1234567',
              label: {
                normal_printer: ['https://sendcloud.example.com/label-a4.pdf'],
                label_printer: 'https://sendcloud.example.com/label-thermal.pdf',
              },
            },
          ],
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
        carrierService: 'colissimo:post-office',
        reference: 'order-uuid-1',
        pickupPoint: {
          id: 'SP12345',
          name: 'Auchan',
          street: '25 Rue de Rivoli',
          postalCode: '75001',
          city: 'Paris',
          country: 'FR',
          carrier: 'colissimo',
        },
      })

      expect(label.labelUrl).toBe('https://sendcloud.example.com/label-thermal.pdf')
      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      const body = JSON.parse((calls[0][1] as { body: string }).body)
      expect(body.to_service_point).toEqual({ id: 'SP12345' })
    })

    it('omits reserved non-routable test email domains (.local, .invalid) from Sendcloud v3 addresses', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'true')
      const fetchFn = makeFetch({
        data: {
          id: 'shipment-uuid-reserved-email',
          carrier: { code: 'sendcloud' },
          parcels: [{ id: 1001, tracking_number: '', documents: [] }],
        },
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      await provider.createLabel({
        origin: { ...origin, email: 'creator@eurtisan.local' },
        destination: { ...destination, email: 'staging-walkthrough@example.invalid' },
        package: pkg,
        carrierService: 'colissimo:home/fr',
        reference: 'order-uuid-reserved',
      })

      const body = JSON.parse(
        ((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1] as { body: string }).body,
      )
      expect(body.from_address.email).toBeUndefined()
      expect(body.to_address.email).toBeUndefined()
    })

    it('rejects incomplete origin address before calling Sendcloud', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'false')
      const fetchFn = makeFetch({})

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      await expect(
        provider.createLabel({
          origin: { ...origin, street: '   ' },
          destination,
          package: pkg,
          carrierService: 'colissimo:home/fr',
        }),
      ).rejects.toMatchObject({
        name: 'SendcloudError',
        statusCode: 400,
      })

      expect(fetchFn).not.toHaveBeenCalled()
    })

    it('parses Sendcloud v3 errors array into SendcloudError.sendcloudMessage', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'false')
      const fetchFn = makeFetch(
        {
          errors: [
            {
              status: '400',
              code: 'validation_error',
              detail: 'Invalid postal code',
              source: { pointer: '/to_address/postal_code' },
            },
          ],
        },
        400,
      )

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
          carrierService: 'colissimo:home/fr',
          reference: 'order-uuid-1',
        }),
      ).rejects.toMatchObject({
        name: 'SendcloudError',
        statusCode: 400,
        sendcloudMessage: '/to_address/postal_code: Invalid postal code',
      })
    })

    it('pins shipping_option_code to sendcloud:letter when force unstamped letter is enabled and override is unset or empty', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'true')
      vi.stubEnv('SENDCLOUD_UNSTAMPED_LETTER_OPTION_CODE', '')

      const fetchFn = makeFetch({
        data: {
          id: 'shipment-uuid-3',
          carrier: { code: 'sendcloud' },
          parcels: [
            {
              id: 987,
              tracking_number: '',
              documents: [{ type: 'label', link: 'https://sendcloud.example.com/unstamped.pdf' }],
            },
          ],
        },
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
        carrierService: 'colissimo:home/fr',
        reference: 'order-uuid-1',
      })

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      expect(calls).toHaveLength(1)
      expect(String(calls[0][0])).toBe('https://panel.sendcloud.sc/api/v3/shipments/announce')
      const body = JSON.parse((calls[0][1] as { body: string }).body)
      expect(body.ship_with.properties.shipping_option_code).toBe('sendcloud:letter')
    })

    it('fails closed without announcing a shipment when unstamped letter override is invalid', async () => {
      vi.stubEnv('SENDCLOUD_FORCE_UNSTAMPED_LETTER', 'true')
      vi.stubEnv('SENDCLOUD_UNSTAMPED_LETTER_OPTION_CODE', 'colissimo:home/fr')

      const fetchFn = makeFetch({})

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
          carrierService: 'colissimo:home/fr',
          reference: 'order-uuid-1',
        }),
      ).rejects.toMatchObject({
        name: 'SendcloudError',
        statusCode: 503,
      })

      expect(fetchFn).not.toHaveBeenCalled()
    })
  })

  describe('trackShipment', () => {
    it('calls Sendcloud v3 parcel tracking endpoint and returns chronological events and mapped status', async () => {
      const fetchFn = makeFetch({
        data: {
          tracking_numbers: [{ tracking_number: '3SABC1234567', carrier: 'colissimo' }],
          details: { expected_delivery_date: '2026-06-03' },
          events: [
            {
              timestamp: '2026-06-03T10:00:00Z',
              phase: 'delivered',
              exception: 'none',
              description: 'Delivered to recipient',
            },
            {
              timestamp: '2026-06-02T10:00:00Z',
              phase: 'in_transit',
              exception: 'none',
              description: 'In transit',
            },
            {
              timestamp: '2026-06-01T10:00:00Z',
              phase: 'announced',
              exception: 'none',
              description: 'Label created',
            },
          ],
        },
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const info = await provider.trackShipment('3SABC1234567')

      expect(String((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][0])).toBe(
        'https://panel.sendcloud.sc/api/v3/parcels/tracking/3SABC1234567',
      )
      expect(info.trackingNumber).toBe('3SABC1234567')
      expect(info.carrier).toBe('colissimo')
      expect(info.status).toBe('delivered')
      expect(info.estimatedDelivery).toBe('2026-06-03')
      expect(info.events).toHaveLength(3)
      expect(info.events[0].status).toBe('Label created')
      expect(info.events[2].status).toBe('Delivered to recipient')
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
    it('queries Sendcloud v3 shipping-options with to_service_point_id and returns v3 option codes', async () => {
      const fetchFn = makeFetch({
        data: [
          {
            code: 'colissimo:post-office',
            name: 'Colissimo Service Point',
            carrier: { code: 'colissimo', name: 'Colissimo' },
          },
          {
            code: 'sendcloud:letter',
            name: 'Unstamped letter',
            carrier: { code: 'sendcloud', name: 'Sendcloud' },
          },
        ],
      })

      const provider = new SendcloudProvider({
        publicKey: 'pk',
        secretKey: 'sk',
        fetch: fetchFn,
      })

      const methods = await provider.getServicePointMethods('12345')

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls
      expect(String(calls[0][0])).toBe('https://panel.sendcloud.sc/api/v3/shipping-options')
      expect(JSON.parse((calls[0][1] as { body: string }).body)).toEqual({
        to_service_point_id: 12345,
      })
      expect(methods).toHaveLength(1)
      expect(methods[0].rateId).toBe('colissimo:post-office')
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
