import '@tanstack/react-start/server-only'

import type { ShippingProvider } from '#/lib/shipping-provider'
import { getSendcloudPublicKey, getSendcloudSecretKey } from '#/lib/env.server'

export type * from '#/lib/shipping-provider'

export type { MockShippingProviderDeps } from './mock-shipping-provider'

import {
  MockShippingProvider,
  mockShippingProvider,
  resetMockShippingCounter,
} from './mock-shipping-provider'

export type { SendcloudProviderDeps } from './sendcloud-provider'
export { MockShippingProvider, mockShippingProvider, resetMockShippingCounter }

import { SendcloudError, SendcloudProvider, sendcloudProvider } from './sendcloud-provider'

export { SendcloudError, SendcloudProvider, sendcloudProvider }

/**
 * Return the active shipping provider for the current environment.
 *
 * - In tests, or when Sendcloud credentials are missing, the deterministic
 *   mock provider is used so no external API calls are made.
 * - In production, missing credentials throw so the integration fails closed.
 *
 * This must only be called from server-side code.
 */
export function getShippingProvider(): ShippingProvider {
  const publicKey = getSendcloudPublicKey()
  const secretKey = getSendcloudSecretKey()

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return mockShippingProvider
  }

  if (!publicKey || !secretKey) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      throw new Error(
        'Sendcloud credentials are required in production. Set SENDCLOUD_PUBLIC_KEY and SENDCLOUD_SECRET_KEY.',
      )
    }
    return mockShippingProvider
  }

  return sendcloudProvider
}
