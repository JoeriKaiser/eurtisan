import '@tanstack/react-start/server-only'

import { getMollieApiKey, getMollieTestMode, getMockPayoutsEnabled } from '#/lib/env.server'
import { logger } from '#/lib/logger.server'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface CreateRouteInput {
  /** Mollie payment ID (e.g. tr_xxx). */
  paymentId: string
  /** Amount to route to the seller, in euro cents. */
  amountCents: number
  /** Currency code, e.g. EUR. */
  currency: string
  /** Connected seller Mollie organization ID (e.g. org_xxx). */
  destinationOrganizationId: string
  /** Human-readable description for reconciliation. */
  description: string
}

export interface MollieRoute {
  id: string
  paymentId: string
  amount: { currency: string; value: string }
  description: string
  destination: { type: 'organization'; organizationId: string }
  /** Route status as reported by Mollie delayed routing (e.g. pending, routing, routed, returned). */
  status?: string
}

export interface MollieRouteError {
  status: number
  title: string
  detail: string
  field?: string
}

/* -------------------------------------------------------------------------- */
/*                              Mock helpers                                  */
/* -------------------------------------------------------------------------- */

let mockRouteCounter = 0

function nextMockRouteId(): string {
  mockRouteCounter += 1
  return `crt_mock_${String(mockRouteCounter).padStart(6, '0')}`
}

/** Resets the mock route counter for deterministic tests. */
export function resetMockRouteCounter(): void {
  mockRouteCounter = 0
}

/** Controls whether the next mock route creation should fail. */
let shouldFailNextMockRoute = false
let nextMockRouteFailureReason: string | undefined

/**
 * Configures the mock client to fail the next route creation call.
 * For tests only.
 */
export function setMockRouteFailure(reason?: string): void {
  shouldFailNextMockRoute = true
  nextMockRouteFailureReason = reason
}

/** Clears any pending mock route failure. For tests only. */
export function clearMockRouteFailure(): void {
  shouldFailNextMockRoute = false
  nextMockRouteFailureReason = undefined
}

let mockRouteStatus = 'routed'

/**
 * Configures the status returned by the mock get-route client.
 * For tests only.
 */
export function setMockRouteStatus(status: string): void {
  mockRouteStatus = status
}

/** Resets the mock route status to the default. For tests only. */
export function resetMockRouteStatus(): void {
  mockRouteStatus = 'routed'
}

/* -------------------------------------------------------------------------- */
/*                              Real client                                   */
/* -------------------------------------------------------------------------- */

const MOLLIE_API_BASE = 'https://api.mollie.com/v2'

function formatMoneyValue(cents: number): string {
  return `${(cents / 100).toFixed(2)}`
}

function isRouteNotRoutable(status: number): boolean {
  // Mollie returns 404 when the payment is not yet routable, even if paid.
  // There is no stable error code for this, so we treat any 404 on route
  // creation as a transient "not routable yet" condition.
  return status === 404
}

function parseMollieError(body: string): MollieRouteError {
  try {
    const parsed = JSON.parse(body) as {
      status?: number
      title?: string
      detail?: string
      field?: string
    }
    return {
      status: parsed.status ?? 0,
      title: parsed.title ?? 'Mollie API error',
      detail: parsed.detail ?? body,
      field: parsed.field,
    }
  } catch {
    return { status: 0, title: 'Mollie API error', detail: body }
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createMollieRouteReal(input: CreateRouteInput): Promise<MollieRoute> {
  const apiKey = getMollieApiKey()
  if (!apiKey) {
    throw new Error('MOLLIE_API_KEY is not set')
  }

  const url = `${MOLLIE_API_BASE}/payments/${encodeURIComponent(input.paymentId)}/routes`
  const body: Record<string, unknown> = {
    amount: {
      currency: input.currency.toUpperCase(),
      value: formatMoneyValue(input.amountCents),
    },
    description: input.description,
    destination: {
      type: 'organization',
      organizationId: input.destinationOrganizationId,
    },
  }

  if (getMollieTestMode()) {
    body.testmode = true
  }

  const maxRetries = 5
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const data = (await response.json()) as {
        id: string
        paymentId?: string
        amount?: { currency: string; value: string }
        description?: string
        destination?: { type: string; organizationId: string }
      }
      return {
        id: data.id,
        paymentId: data.paymentId ?? input.paymentId,
        amount: data.amount ?? {
          currency: input.currency,
          value: formatMoneyValue(input.amountCents),
        },
        description: data.description ?? input.description,
        destination: (data.destination ?? {
          type: 'organization',
          organizationId: input.destinationOrganizationId,
        }) as { type: 'organization'; organizationId: string },
      }
    }

    const responseBody = await response.text()
    const error = parseMollieError(responseBody)

    if (isRouteNotRoutable(response.status) && attempt < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max ~31s total)
      const waitMs = 1000 * 2 ** attempt
      logger.info(
        `Mollie route not routable yet for payment ${input.paymentId}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`,
      )
      await delay(waitMs)
      continue
    }

    lastError = new Error(
      `Mollie route creation failed (${error.status}): ${error.title} - ${error.detail}`,
    )
    logger.error('Mollie route creation failed', lastError, {
      alert: true,
      paymentId: input.paymentId,
      destinationOrganizationId: input.destinationOrganizationId,
      amountCents: input.amountCents,
      mollieError: error,
    })
    throw lastError
  }

  throw lastError ?? new Error('Mollie route creation failed after retries')
}

async function getMollieRouteReal(paymentId: string, routeId: string): Promise<MollieRoute | null> {
  const apiKey = getMollieApiKey()
  if (!apiKey) {
    throw new Error('MOLLIE_API_KEY is not set')
  }

  const query = getMollieTestMode() ? '?testmode=true' : ''
  const url = `${MOLLIE_API_BASE}/payments/${encodeURIComponent(paymentId)}/routes/${encodeURIComponent(routeId)}${query}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const body = await response.text()
    const error = parseMollieError(body)
    throw new Error(`Mollie get route failed (${error.status}): ${error.title} - ${error.detail}`)
  }

  const data = (await response.json()) as {
    id: string
    paymentId?: string
    amount: { currency: string; value: string }
    description?: string
    destination: { type: string; organizationId: string }
    status?: string
  }

  return {
    id: data.id,
    paymentId: data.paymentId ?? paymentId,
    amount: data.amount,
    description: data.description ?? '',
    destination: data.destination as { type: 'organization'; organizationId: string },
    status: data.status,
  }
}

/* -------------------------------------------------------------------------- */
/*                              Mock client                                   */
/* -------------------------------------------------------------------------- */

async function createMollieRouteMock(input: CreateRouteInput): Promise<MollieRoute> {
  await delay(20)

  if (shouldFailNextMockRoute) {
    const reason = nextMockRouteFailureReason
    clearMockRouteFailure()
    throw new Error(reason ?? 'Mock route creation failed')
  }

  return {
    id: nextMockRouteId(),
    paymentId: input.paymentId,
    amount: {
      currency: input.currency.toUpperCase(),
      value: formatMoneyValue(input.amountCents),
    },
    description: input.description,
    destination: {
      type: 'organization',
      organizationId: input.destinationOrganizationId,
    },
  }
}

async function getMollieRouteMock(
  _paymentId: string,
  routeId: string,
): Promise<MollieRoute | null> {
  await delay(10)
  if (!routeId.startsWith('crt_mock_')) {
    return null
  }
  return {
    id: routeId,
    paymentId: _paymentId,
    amount: { currency: 'EUR', value: '0.00' },
    description: 'Mock route',
    destination: { type: 'organization', organizationId: 'org_mock' },
    status: mockRouteStatus,
  }
}

/* -------------------------------------------------------------------------- */
/*                             Public API                                     */
/* -------------------------------------------------------------------------- */

function isMockMode(): boolean {
  const apiKey = getMollieApiKey()
  if (getMockPayoutsEnabled()) return true
  if (!apiKey) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: MOLLIE_API_KEY is required in production for payouts. ' +
          'Set MOLLIE_API_KEY or explicitly enable mock mode with MOCK_PAYOUTS_ENABLED=true',
      )
    }
    return true
  }
  return false
}

/**
 * Creates a delayed-routing route on a Mollie payment, moving funds from the
 * platform balance to a connected seller organization.
 *
 * In development or when MOCK_PAYOUTS_ENABLED is true, this uses a mock client
 * that generates deterministic IDs and never makes HTTP requests.
 */
export async function createMollieRoute(input: CreateRouteInput): Promise<MollieRoute> {
  if (isMockMode()) {
    return createMollieRouteMock(input)
  }
  return createMollieRouteReal(input)
}

/**
 * Retrieves a previously created route from Mollie.
 * Returns null if the route does not exist.
 */
export async function getMollieRoute(
  paymentId: string,
  routeId: string,
): Promise<MollieRoute | null> {
  if (isMockMode()) {
    return getMollieRouteMock(paymentId, routeId)
  }
  return getMollieRouteReal(paymentId, routeId)
}
