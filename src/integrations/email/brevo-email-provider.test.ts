/**
 * Brevo email provider timeout, retry, and error handling tests.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrevoEmailProvider } from './brevo-email-provider'

const originalEnv: Record<string, string | undefined> = {}

function setEnv(key: string, value: string) {
  if (!(key in originalEnv)) {
    originalEnv[key] = process.env[key]
  }
  process.env[key] = value
}

function createMockResponse(status: number, bodyText: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(bodyText),
    json: vi.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
  } as unknown as Response
}

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  for (const key of Object.keys(originalEnv)) {
    delete originalEnv[key]
  }
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('BrevoEmailProvider sendReal timeout', () => {
  it('throws a clear timeout error when fetch aborts', async () => {
    setEnv('BREVO_API_KEY', 'test-api-key')

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new DOMException('The operation timed out.', 'AbortError'))

    const provider = new BrevoEmailProvider({ mock: false })

    await expect(
      provider.sendTransactional('alice@example.com', 'order_confirmation', {
        orderNumber: '42',
      }),
    ).rejects.toThrow('Brevo email send timed out after 10 seconds')

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fetchSpy.mockRestore()
  })

  it('re-throws non-abort fetch errors after exhausting retries', async () => {
    setEnv('BREVO_API_KEY', 'test-api-key')
    vi.useFakeTimers()

    const networkError = new TypeError('fetch failed')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkError)

    const provider = new BrevoEmailProvider({ mock: false })

    let caughtError: unknown
    const promise = provider
      .sendTransactional('alice@example.com', 'order_confirmation', {
        orderNumber: '42',
      })
      .catch((err) => {
        caughtError = err
      })

    await vi.runAllTimersAsync()
    await promise

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toBe('fetch failed')
    expect(fetchSpy).toHaveBeenCalledTimes(4)

    fetchSpy.mockRestore()
  })
})

describe('BrevoEmailProvider retry logic', () => {
  it('does not retry on 4xx errors', async () => {
    setEnv('BREVO_API_KEY', 'test-api-key')

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(createMockResponse(400, 'Bad Request'))

    const provider = new BrevoEmailProvider({ mock: false })

    await expect(
      provider.sendTransactional('alice@example.com', 'order_confirmation', {
        orderNumber: '42',
      }),
    ).rejects.toThrow('Brevo API error (400): Bad Request')

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    fetchSpy.mockRestore()
  })

  it('retries on 5xx errors and succeeds on recovery', async () => {
    setEnv('BREVO_API_KEY', 'test-api-key')
    vi.useFakeTimers()

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createMockResponse(500, 'Internal Server Error'))
      .mockResolvedValueOnce(createMockResponse(200, 'OK'))

    const provider = new BrevoEmailProvider({ mock: false })

    const promise = provider.sendTransactional('alice@example.com', 'order_confirmation', {
      orderNumber: '42',
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.accepted).toBe(true)
    expect(result.messageId).toBe('test-msg-id')
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    fetchSpy.mockRestore()
  })

  it('retries on network errors and succeeds on recovery', async () => {
    setEnv('BREVO_API_KEY', 'test-api-key')
    vi.useFakeTimers()

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(createMockResponse(200, 'OK'))

    const provider = new BrevoEmailProvider({ mock: false })

    const promise = provider.sendTransactional('alice@example.com', 'order_confirmation', {
      orderNumber: '42',
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.accepted).toBe(true)
    expect(result.messageId).toBe('test-msg-id')
    expect(fetchSpy).toHaveBeenCalledTimes(3)

    fetchSpy.mockRestore()
  })

  it('exhausts all retries on persistent 5xx and throws last error', async () => {
    setEnv('BREVO_API_KEY', 'test-api-key')
    vi.useFakeTimers()

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(createMockResponse(502, 'Bad Gateway'))

    const provider = new BrevoEmailProvider({ mock: false })

    let caughtError: unknown
    const promise = provider
      .sendTransactional('alice@example.com', 'order_confirmation', {
        orderNumber: '42',
      })
      .catch((err) => {
        caughtError = err
      })

    await vi.runAllTimersAsync()
    await promise

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toBe('Brevo API error (502): Bad Gateway')
    expect(fetchSpy).toHaveBeenCalledTimes(4)

    fetchSpy.mockRestore()
  })
})
