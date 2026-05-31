import { m } from '#/paraglide/messages'
import { getBaseUrl } from './env.server'

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** EU-required business sender block + notification preferences link for all transactional emails. */
export function renderEmailLegalFooterHtml(): string {
  const settingsUrl = `${getBaseUrl()}/account/settings`
  return `<div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <p style="margin: 0 0 8px;">${escapeHtml(
      m.email_legal_sender_block({
        name: m.legal_operator_name(),
        address: m.legal_operator_address(),
        vat: m.legal_vat_number(),
        email: m.legal_contact_email(),
      }),
    )}</p>
    <p style="margin: 0 0 8px;">${escapeHtml(m.email_footer())}</p>
    <p style="margin: 0;"><a href="${escapeHtml(settingsUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(m.email_manage_notifications())}</a></p>
  </div>`
}

export function renderEmailLegalFooterText(): string {
  const settingsUrl = `${getBaseUrl()}/account/settings`
  return `${m.email_legal_sender_block({
    name: m.legal_operator_name(),
    address: m.legal_operator_address(),
    vat: m.legal_vat_number(),
    email: m.legal_contact_email(),
  })}

${m.email_footer()}

${m.email_manage_notifications()}: ${settingsUrl}`
}
