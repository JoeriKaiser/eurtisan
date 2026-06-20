import { beforeEach, describe, expect, it } from 'vitest'

import { clearTestTables } from '#/test/cleanup'
import { createUser } from '#/test/factories'

import { getEmailHeaders } from './email-headers.server'

beforeEach(async () => {
  await clearTestTables()
})

describe('getEmailHeaders', () => {
  it('returns empty headers for an unknown email', async () => {
    const headers = await getEmailHeaders(
      'unknown@example.com',
      'order_confirmation',
      'transactional',
    )
    expect(headers).toEqual({})
  })

  it('includes List-Unsubscribe and List-Unsubscribe-Post for a known user', async () => {
    const u = await createUser({ email: 'alice@example.com' })
    const headers = await getEmailHeaders(u.email, 'order_confirmation', 'transactional')

    expect(headers['List-Unsubscribe']).toMatch(
      /^<http:\/\/localhost:3000\/api\/unsubscribe\?token=[^&>]+>$/,
    )
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('includes the category parameter for opt-out categories', async () => {
    const u = await createUser({ email: 'bob@example.com' })
    const headers = await getEmailHeaders(u.email, 'shipping_notification', 'seller_updates')

    expect(headers['List-Unsubscribe']).toContain('category=seller_updates')
  })

  it('omits the category parameter for transactional emails', async () => {
    const u = await createUser({ email: 'charlie@example.com' })
    const headers = await getEmailHeaders(u.email, 'order_confirmation', 'transactional')

    expect(headers['List-Unsubscribe']).not.toContain('category=')
  })

  it('normalizes email case when looking up the user', async () => {
    await createUser({ email: 'CaseTest@Example.com' })
    const headers = await getEmailHeaders(
      'casetest@example.com',
      'order_confirmation',
      'transactional',
    )

    expect(headers['List-Unsubscribe']).toBeTruthy()
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
})
