import { beforeEach, describe, expect, it } from 'vitest'

import { clearTestTables } from '#/test/cleanup'
import { createUser } from '#/test/factories'

import { getOrCreateUnsubscribeToken, isEmailEnabledForUser } from '#/lib/email-preferences.server'
import { Route } from './unsubscribe'

beforeEach(async () => {
  await clearTestTables()
})

describe('/api/unsubscribe POST', () => {
  async function post(token: string, category?: string): Promise<Response> {
    const body = new URLSearchParams()
    body.append('token', token)
    if (category) body.append('category', category)

    const request = new Request('http://localhost:3000/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    const handlers = Route.options.server?.handlers as {
      POST: (ctx: { request: Request }) => Promise<Response>
    }
    return handlers.POST({ request })
  }

  it('returns 200 and disables a single category', async () => {
    const u = await createUser()
    const token = await getOrCreateUnsubscribeToken(u.id)

    const response = await post(token, 'seller_updates')
    expect(response.status).toBe(200)
    expect(await isEmailEnabledForUser(u.id, 'seller_updates')).toBe(false)
    expect(await isEmailEnabledForUser(u.id, 'platform_announcements')).toBe(true)
  })

  it('returns 200 and disables all opt-out categories when category is omitted', async () => {
    const u = await createUser()
    const token = await getOrCreateUnsubscribeToken(u.id)

    const response = await post(token)
    expect(response.status).toBe(200)
    expect(await isEmailEnabledForUser(u.id, 'seller_updates')).toBe(false)
    expect(await isEmailEnabledForUser(u.id, 'marketing')).toBe(false)
    expect(await isEmailEnabledForUser(u.id, 'platform_announcements')).toBe(false)
  })

  it('returns 400 for an invalid token', async () => {
    const response = await post('invalid-token')
    expect(response.status).toBe(400)
  })

  it('returns 400 for an empty token', async () => {
    const response = await post('')
    expect(response.status).toBe(400)
  })
})
