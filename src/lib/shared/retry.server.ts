/**
 * Shared retry helpers for transient failures.
 */

export const DEFAULT_EMAIL_RETRY_DELAYS_MS = [1000, 2000, 4000]

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  delays = DEFAULT_EMAIL_RETRY_DELAYS_MS,
): Promise<T> {
  let lastError: unknown

  for (let i = 0; i <= delays.length; i++) {
    try {
      return await operation()
    } catch (err) {
      lastError = err
      if (i === delays.length || !shouldRetry(err)) {
        throw err
      }
      await delay(delays[i])
    }
  }

  throw lastError
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
