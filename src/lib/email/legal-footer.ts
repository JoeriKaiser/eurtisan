import '@tanstack/react-start/server-only'

import { m } from '#/paraglide/messages'
import { getBaseUrl } from '../env.server'
import { getOrCreateUnsubscribeToken } from './preferences.server'
type EmailLocale = 'en' | 'nl'

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function buildUnsubscribeUrl(to?: string): Promise<string | null> {
  if (!to) return null

  const normalized = to.trim().toLowerCase()
  const { db } = await import('#/db/index')
  const { user } = await import('#/db/schema')
  const { eq } = await import('drizzle-orm')

  const row = await db.select({ id: user.id }).from(user).where(eq(user.email, normalized)).limit(1)
  if (!row[0]) return null

  const token = await getOrCreateUnsubscribeToken(row[0].id)
  return `${getBaseUrl()}/unsubscribe?token=${encodeURIComponent(token)}`
}

/** EU-required business sender block + notification preferences link for all transactional emails. */
export async function renderEmailLegalFooterHtml(
  to?: string,
  locale?: EmailLocale,
): Promise<string> {
  const settingsUrl = `${getBaseUrl()}/account/settings`
  const unsubscribeUrl = await buildUnsubscribeUrl(to)
  const messageOptions = locale ? { locale } : undefined

  return `<div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <p style="margin: 0 0 8px;">${escapeHtml(
      m.email_legal_sender_block(
        {
          name: m.legal_operator_name(undefined, messageOptions),
          address: m.legal_operator_address(undefined, messageOptions),
          vat: m.legal_vat_number(undefined, messageOptions),
          email: m.legal_contact_email(undefined, messageOptions),
        },
        messageOptions,
      ),
    )}</p>
    <p style="margin: 0 0 8px;">${escapeHtml(m.email_footer(undefined, messageOptions))}</p>
    <p style="margin: 0 0 8px;"><a href="${escapeHtml(settingsUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(m.email_manage_notifications(undefined, messageOptions))}</a></p>
    ${unsubscribeUrl ? `<p style="margin: 0;"><a href="${escapeHtml(unsubscribeUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(m.email_unsubscribe_one_click(undefined, messageOptions))}</a></p>` : '<p style="margin: 0;"></p>'}
  </div>`
}

export async function renderEmailLegalFooterText(
  to?: string,
  locale?: EmailLocale,
): Promise<string> {
  const settingsUrl = `${getBaseUrl()}/account/settings`
  const unsubscribeUrl = await buildUnsubscribeUrl(to)
  const messageOptions = locale ? { locale } : undefined

  return `${m.email_legal_sender_block(
    {
      name: m.legal_operator_name(undefined, messageOptions),
      address: m.legal_operator_address(undefined, messageOptions),
      vat: m.legal_vat_number(undefined, messageOptions),
      email: m.legal_contact_email(undefined, messageOptions),
    },
    messageOptions,
  )}

${m.email_footer(undefined, messageOptions)}

${m.email_manage_notifications(undefined, messageOptions)}: ${settingsUrl}${unsubscribeUrl ? `\n${m.email_unsubscribe_one_click(undefined, messageOptions)}: ${unsubscribeUrl}` : ''}`
}
