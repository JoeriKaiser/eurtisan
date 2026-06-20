import { beforeEach, describe, expect, it } from 'vitest'

import { clearTestTables } from '#/test/cleanup'
import { createUser } from '#/test/factories'

import { renderEmailLegalFooterHtml, renderEmailLegalFooterText } from './email-legal-footer'

beforeEach(async () => {
  await clearTestTables()
})

describe('renderEmailLegalFooterHtml', () => {
  it('includes the manage notification preferences link', async () => {
    const html = await renderEmailLegalFooterHtml()
    expect(html).toContain('Manage notification preferences')
    expect(html).toContain('/account/settings')
  })

  it('includes a one-click unsubscribe link when an email is provided', async () => {
    const u = await createUser({ email: 'alice@example.com' })
    const html = await renderEmailLegalFooterHtml(u.email)

    expect(html).toContain('Unsubscribe with one click')
    expect(html).toContain('/api/unsubscribe?token=')
  })

  it('omits the one-click unsubscribe link when no email is provided', async () => {
    const html = await renderEmailLegalFooterHtml()
    expect(html).not.toContain('Unsubscribe with one click')
  })

  it('omits the one-click unsubscribe link for an unknown email', async () => {
    const html = await renderEmailLegalFooterHtml('unknown@example.com')
    expect(html).not.toContain('Unsubscribe with one click')
  })
})

describe('renderEmailLegalFooterText', () => {
  it('includes the one-click unsubscribe link when an email is provided', async () => {
    const u = await createUser({ email: 'bob@example.com' })
    const text = await renderEmailLegalFooterText(u.email)

    expect(text).toContain('Unsubscribe with one click')
    expect(text).toContain('/api/unsubscribe?token=')
  })

  it('omits the one-click unsubscribe link when no email is provided', async () => {
    const text = await renderEmailLegalFooterText()
    expect(text).not.toContain('Unsubscribe with one click')
  })
})
