import '@tanstack/react-start/server-only'

/**
 * Transactional email templates.
 *
 * Each template returns an HTML body, a plain-text body, and a subject line.
 * Render errors are caught by the caller so a plain-text fallback can be sent.
 */

import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import type { EmailTemplate } from './provider'
import { renderEmailLegalFooterHtml, renderEmailLegalFooterText } from './legal-footer'

/** Result of rendering a template. */
export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/** Render a template with the given data. Throws on missing required fields. */
export async function renderTemplate(
  template: EmailTemplate,
  data: Record<string, unknown>,
  to?: string,
): Promise<RenderedEmail> {
  switch (template) {
    case 'order_confirmation':
      return renderOrderConfirmation(data, to)
    case 'shipping_notification':
      return renderShippingNotification(data, to)
    case 'dispute_update':
      return renderDisputeUpdate(data, to)
    case 'order_refunded':
      return renderOrderRefunded(data, to)
    case 'email_verification':
      return renderEmailVerification(data, to)
    case 'password_reset':
      return renderPasswordReset(data, to)
    case 'account_security_alert':
      return renderAccountSecurityAlert(data, to)
    case 'shop_moderation_update':
      return renderShopModerationUpdate(data, to)
    default: {
      // Exhaustiveness check — should never happen at runtime with correct types.
      const _exhaustive: never = template
      throw new Error(`Unknown email template: ${_exhaustive}`)
    }
  }
}

/** Plain-text fallback used when template rendering fails. */
export function renderFallbackPlainText(
  template: EmailTemplate,
  data: Record<string, unknown>,
): { subject: string; text: string } {
  const friendlyName = template.replace(/_/g, ' ')
  return {
    subject: `[Eurtisan] ${friendlyName}`,
    text: `Eurtisan update: ${friendlyName}\n\n${JSON.stringify(data, null, 2)}`,
  }
}

/* -------------------------------------------------------------------------- */
/*                            Order Confirmation                              */
/* -------------------------------------------------------------------------- */

async function renderOrderConfirmation(
  data: Record<string, unknown>,
  to?: string,
): Promise<RenderedEmail> {
  const orderNumber = String(data.orderNumber ?? '—')
  const buyerName = String(data.buyerName ?? 'Valued Customer')
  const shopName = String(data.shopName ?? 'Eurtisan')
  const items = Array.isArray(data.items) ? data.items : []
  const total = String(data.total ?? '—')
  const orderUrl = String(data.orderUrl ?? '')
  const sellerTradeName = data.sellerTradeName ? String(data.sellerTradeName) : null
  const sellerContactEmail = data.sellerContactEmail ? String(data.sellerContactEmail) : null
  const sellerAddress = data.sellerAddress ? String(data.sellerAddress) : null
  const sellerVatId = data.sellerVatId ? String(data.sellerVatId) : null

  const sellerBlockHtml =
    sellerTradeName && sellerContactEmail
      ? `<br /><div style="color: #374151; font-size: 14px; line-height: 1.5;">
  <strong>${escapeHtml(m.email_seller_identity_title())}</strong><br />
  ${escapeHtml(sellerTradeName)}<br />
  ${sellerAddress ? `${escapeHtml(sellerAddress)}<br />` : ''}
  ${escapeHtml(m.checkout_seller_contact_label())}: ${escapeHtml(sellerContactEmail)}<br />
  ${sellerVatId ? `${escapeHtml(m.checkout_seller_vat_label())}: ${escapeHtml(sellerVatId)}` : ''}
</div>`
      : ''

  const itemsListHtml = items
    .map((item: unknown) => {
      if (typeof item !== 'object' || item === null) return ''
      const i = item as Record<string, unknown>
      const name = String(i.name ?? 'Item')
      const quantity = Number(i.quantity ?? 1)
      const price = String(i.price ?? '—')
      return `<li>${escapeHtml(m.email_item_line({ name, quantity, price }))}</li>`
    })
    .join('')

  const itemsListText = items
    .map((item: unknown) => {
      if (typeof item !== 'object' || item === null) return ''
      const i = item as Record<string, unknown>
      const name = String(i.name ?? 'Item')
      const quantity = Number(i.quantity ?? 1)
      const price = String(i.price ?? '—')
      return `- ${m.email_item_line({ name, quantity, price })}`
    })
    .join('\n')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">${escapeHtml(
    m.email_order_confirmation_title({ buyerName }),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${m
    .email_order_confirmation_body({
      orderNumber,
      shopName,
    })
    .replace(`#${orderNumber}`, `<strong>#${escapeHtml(orderNumber)}</strong>`)
    .replace(shopName, `<strong>${escapeHtml(shopName)}</strong>`)}</div>
  <br />
  <div style="font-weight: 600; color: #111827; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_order_confirmation_items(),
  )}</div>
  <ul style="padding-left: 20px; color: #374151; font-size: 16px; line-height: 1.5;">${itemsListHtml}</ul>
  <br />
  <div style="font-weight: 600; color: #111827; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_total({ total }),
  )}</div>
  ${orderUrl ? `<br /><div style="font-size: 16px; line-height: 1.5;"><a href="${escapeHtml(orderUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(m.email_order_confirmation_view())}</a></div>` : ''}
  ${sellerBlockHtml}
  <br /><br />
  ${await renderEmailLegalFooterHtml(to)}`

  const html = wrapInEmailTemplate(
    m.email_order_confirmation_subject({ orderNumber, shopName }),
    contentHtml,
  )

  const text = `${m.email_order_confirmation_title({ buyerName })}

${m.email_order_confirmation_body({ orderNumber, shopName })}

${m.email_order_confirmation_items()}
${itemsListText || '- No items'}

${m.email_total({ total })}
${orderUrl ? `${m.email_order_confirmation_view_txt({ orderUrl })}` : ''}
${sellerTradeName && sellerContactEmail ? `\n${m.email_seller_identity_title()}: ${sellerTradeName}${sellerAddress ? `, ${sellerAddress}` : ''}\n${m.checkout_seller_contact_label()}: ${sellerContactEmail}${sellerVatId ? `\n${m.checkout_seller_vat_label()}: ${sellerVatId}` : ''}` : ''}

${await renderEmailLegalFooterText(to)}`

  return { subject: m.email_order_confirmation_subject({ orderNumber, shopName }), html, text }
}

/* -------------------------------------------------------------------------- */
/*                          Shipping Notification                             */
/* -------------------------------------------------------------------------- */

async function renderShippingNotification(
  data: Record<string, unknown>,
  to?: string,
): Promise<RenderedEmail> {
  const orderNumber = String(data.orderNumber ?? '—')
  const buyerName = String(data.buyerName ?? 'Valued Customer')
  const shopName = String(data.shopName ?? 'Eurtisan')
  const trackingNumber = String(data.trackingNumber ?? '—')
  const carrier = String(data.carrier ?? '—')
  const estimatedDelivery = String(data.estimatedDelivery ?? '—')
  const trackingUrl = String(data.trackingUrl ?? '')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">${escapeHtml(
    m.email_shipping_title({ buyerName }),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${m
    .email_shipping_body({
      orderNumber,
      shopName,
    })
    .replace(`#${orderNumber}`, `<strong>#${escapeHtml(orderNumber)}</strong>`)
    .replace(shopName, `<strong>${escapeHtml(shopName)}</strong>`)}</div>
  <br />
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; width: 100%;" bgcolor="#f9fafb">
    <tr>
      <td style="padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #374151;">
        <div><strong>${escapeHtml(m.email_shipping_carrier())}</strong> ${escapeHtml(carrier)}</div>
        <br />
        <div><strong>${escapeHtml(m.email_shipping_tracking_number())}</strong> ${escapeHtml(trackingNumber)}</div>
        <br />
        <div><strong>${escapeHtml(m.email_shipping_estimated_delivery())}</strong> ${escapeHtml(estimatedDelivery)}</div>
      </td>
    </tr>
  </table>
  ${trackingUrl ? `<br /><div style="font-size: 16px; line-height: 1.5;"><a href="${escapeHtml(trackingUrl)}" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${escapeHtml(m.email_shipping_track())}</a></div>` : ''}
  <br /><br />
  ${await renderEmailLegalFooterHtml(to)}`

  const html = wrapInEmailTemplate(m.email_shipping_subject({ orderNumber, shopName }), contentHtml)

  const text = `${m.email_shipping_title({ buyerName })}

${m.email_shipping_body({ orderNumber, shopName })}

${m.email_shipping_carrier()} ${carrier}
${m.email_shipping_tracking_number()} ${trackingNumber}
${m.email_shipping_estimated_delivery()} ${estimatedDelivery}
${trackingUrl ? `${m.email_shipping_track_txt({ trackingUrl })}` : ''}

${await renderEmailLegalFooterText(to)}`

  return { subject: m.email_shipping_subject({ orderNumber, shopName }), html, text }
}

/* -------------------------------------------------------------------------- */
/*                             Dispute Update                                 */
/* -------------------------------------------------------------------------- */

async function renderDisputeUpdate(
  data: Record<string, unknown>,
  to?: string,
): Promise<RenderedEmail> {
  const orderNumber = String(data.orderNumber ?? '—')
  const buyerName = String(data.buyerName ?? 'Valued Customer')
  const shopName = String(data.shopName ?? 'Eurtisan')
  const status = String(data.status ?? 'updated')
  const message = String(data.message ?? '')
  const disputeUrl = String(data.disputeUrl ?? '')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">${escapeHtml(
    m.email_dispute_title({ orderNumber }),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_greeting({ name: buyerName }),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${m
    .email_dispute_body({
      orderNumber,
      shopName,
    })
    .replace(`#${orderNumber}`, `<strong>#${escapeHtml(orderNumber)}</strong>`)
    .replace(shopName, `<strong>${escapeHtml(shopName)}</strong>`)}</div>
  <br />
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; width: 100%;" bgcolor="#f9fafb">
    <tr>
      <td style="padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #111827; font-weight: 600;">
        ${escapeHtml(m.email_dispute_status({ status }))}
      </td>
    </tr>
  </table>
  ${message ? `<br /><div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(message)}</div>` : ''}
  ${disputeUrl ? `<br /><div style="font-size: 16px; line-height: 1.5;"><a href="${escapeHtml(disputeUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(m.email_dispute_view())}</a></div>` : ''}
  <br /><br />
  ${await renderEmailLegalFooterHtml(to)}`

  const html = wrapInEmailTemplate(m.email_dispute_subject({ orderNumber, shopName }), contentHtml)

  const text = `${m.email_dispute_title({ orderNumber })}

${m.email_greeting({ name: buyerName })}

${m.email_dispute_body({ orderNumber, shopName })}

${m.email_dispute_status({ status })}
${message ? `\n${message}` : ''}
${disputeUrl ? `\n${m.email_dispute_view_txt({ disputeUrl })}` : ''}

${await renderEmailLegalFooterText(to)}`

  return { subject: m.email_dispute_subject({ orderNumber, shopName }), html, text }
}

/* -------------------------------------------------------------------------- */
/*                              Order Refunded                                */
/* -------------------------------------------------------------------------- */

async function renderOrderRefunded(
  data: Record<string, unknown>,
  to?: string,
): Promise<RenderedEmail> {
  const orderNumber = String(data.orderNumber ?? '—')
  const buyerName = String(data.buyerName ?? 'Valued Customer')
  const shopName = String(data.shopName ?? 'Eurtisan')
  const refundAmount = String(data.refundAmount ?? '—')
  const orderUrl = String(data.orderUrl ?? '')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">${escapeHtml(
    m.email_refund_title({ orderNumber }),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_greeting({ name: buyerName }),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_refund_body({ orderNumber, shopName, refundAmount }),
  )}</div>
  <br />
  ${orderUrl ? `<div style="font-size: 14px; line-height: 1.5;"><a href="${escapeHtml(orderUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(m.email_refund_view())}</a></div><br />` : ''}
  ${await renderEmailLegalFooterHtml(to)}`

  const html = wrapInEmailTemplate(m.email_refund_title({ orderNumber }), contentHtml)

  const text = `${m.email_refund_title({ orderNumber })}

${m.email_greeting({ name: buyerName })}

${m.email_refund_body({ orderNumber, shopName, refundAmount })}

${orderUrl ? `${m.email_refund_view_txt({ orderUrl })}\n\n` : ''}${await renderEmailLegalFooterText(to)}`

  return { subject: m.email_refund_subject({ orderNumber, shopName }), html, text }
}

/* -------------------------------------------------------------------------- */
/*                            Email Verification                              */
/* -------------------------------------------------------------------------- */

async function renderEmailVerification(
  data: Record<string, unknown>,
  to?: string,
): Promise<RenderedEmail> {
  const userName = String(data.userName ?? 'Valued Customer')
  const verificationUrl = String(data.verificationUrl ?? '')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">${escapeHtml(
    m.email_verify_title(),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_greeting({ name: userName }),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_verify_body(),
  )}</div>
  <br />
  <table border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" bgcolor="#2563eb" style="border-radius: 6px; padding: 12px 24px;">
        <a href="${escapeHtml(verificationUrl)}" target="_blank" style="color: #ffffff; text-decoration: none; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px;">${escapeHtml(m.email_verify_button())}</a>
      </td>
    </tr>
  </table>
  <br />
  <div style="color: #374151; font-size: 14px; line-height: 1.5;">${escapeHtml(
    m.email_link_fallback(),
  )}</div>
  <br />
  <div style="font-size: 14px; line-height: 1.5;"><a href="${escapeHtml(verificationUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(verificationUrl)}</a></div>
  <br /><br />
  ${await renderEmailLegalFooterHtml(to)}`

  const html = wrapInEmailTemplate(m.email_verify_title(), contentHtml)

  const text = `${m.email_verify_title()}

${m.email_greeting({ name: userName })}

${m.email_verify_body()}

${m.email_verify_button()}: ${verificationUrl}

${await renderEmailLegalFooterText(to)}`

  return { subject: m.email_verify_subject(), html, text }
}

/* -------------------------------------------------------------------------- */
/*                            Password Reset                                  */
/* -------------------------------------------------------------------------- */

async function renderPasswordReset(
  data: Record<string, unknown>,
  to?: string,
): Promise<RenderedEmail> {
  const userName = String(data.userName ?? 'Valued Customer')
  const resetUrl = String(data.resetUrl ?? '')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">${escapeHtml(
    m.email_reset_title(),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_greeting({ name: userName }),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_reset_body(),
  )}</div>
  <br />
  <table border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" bgcolor="#2563eb" style="border-radius: 6px; padding: 12px 24px;">
        <a href="${escapeHtml(resetUrl)}" target="_blank" style="color: #ffffff; text-decoration: none; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px;">${escapeHtml(m.email_reset_button())}</a>
      </td>
    </tr>
  </table>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_reset_ignore(),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 14px; line-height: 1.5;">${escapeHtml(
    m.email_link_fallback(),
  )}</div>
  <br />
  <div style="font-size: 14px; line-height: 1.5;"><a href="${escapeHtml(resetUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(resetUrl)}</a></div>
  <br /><br />
  ${await renderEmailLegalFooterHtml(to)}`

  const html = wrapInEmailTemplate(m.email_reset_title(), contentHtml)

  const text = `${m.email_reset_title()}

${m.email_greeting({ name: userName })}

${m.email_reset_body()}

${m.email_reset_link_txt({ resetUrl })}

${m.email_reset_ignore()}

${await renderEmailLegalFooterText(to)}`

  return { subject: m.email_reset_subject(), html, text }
}

/* -------------------------------------------------------------------------- */
/*                         Account Security Alert                             */
/* -------------------------------------------------------------------------- */

async function renderAccountSecurityAlert(
  data: Record<string, unknown>,
  to?: string,
): Promise<RenderedEmail> {
  const userName = String(data.userName ?? 'Valued Customer')
  const lockoutDurationMinutes = Number(data.lockoutDurationMinutes ?? 30)

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">${escapeHtml(
    m.email_security_alert_title(),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_greeting({ name: userName }),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_security_alert_body({ lockoutDurationMinutes: String(lockoutDurationMinutes) }),
  )}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(
    m.email_security_alert_ignore(),
  )}</div>
  <br /><br />
  ${await renderEmailLegalFooterHtml(to)}`

  const html = wrapInEmailTemplate(m.email_security_alert_title(), contentHtml)

  const text = `${m.email_security_alert_title()}

${m.email_greeting({ name: userName })}

${m.email_security_alert_body({ lockoutDurationMinutes: String(lockoutDurationMinutes) })}

${m.email_security_alert_ignore()}

${await renderEmailLegalFooterText(to)}`

  return { subject: m.email_security_alert_subject(), html, text }
}

async function renderShopModerationUpdate(
  data: Record<string, unknown>,
  to?: string,
): Promise<RenderedEmail> {
  const creatorName = String(data.creatorName ?? data.buyerName ?? m.email_default_name())
  const shopName = String(data.shopName ?? m.onboarding_untitled_shop())
  const status = String(data.status ?? 'pending_review')
  const note = data.note ? String(data.note) : ''
  const statusUrl = String(data.statusUrl ?? '')
  const statusLabel =
    status === 'approved'
      ? m.seller_hub_status_approved()
      : status === 'changes_requested'
        ? m.seller_hub_status_changes()
        : m.seller_hub_status_rejected()
  const subject = m.email_shop_moderation_subject({ shopName, status: statusLabel })
  const noteHtml = note
    ? `<p style="margin: 16px 0; padding: 12px; background: #f5f2ee; border-radius: 8px;">${escapeHtml(note)}</p>`
    : ''
  const contentHtml = `<h1 style="margin: 0 0 16px; font-size: 24px;">${escapeHtml(
    m.email_shop_moderation_title({ shopName }),
  )}</h1>
  <p>${escapeHtml(m.email_greeting({ name: creatorName }))}</p>
  <p>${escapeHtml(m.email_shop_moderation_body({ status: statusLabel }))}</p>
  ${noteHtml}
  <p><a href="${escapeHtml(statusUrl)}">${escapeHtml(m.email_shop_moderation_cta())}</a></p>
  ${await renderEmailLegalFooterHtml(to)}`
  const text = `${m.email_shop_moderation_title({ shopName })}

${m.email_greeting({ name: creatorName })}

${m.email_shop_moderation_body({ status: statusLabel })}${note ? `\n\n${note}` : ''}

${m.email_shop_moderation_cta()}: ${statusUrl}

${await renderEmailLegalFooterText(to)}`
  return { subject, html: wrapInEmailTemplate(subject, contentHtml), text }
}

/* -------------------------------------------------------------------------- */
/*                             Helpers                                        */
/* -------------------------------------------------------------------------- */

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function wrapInEmailTemplate(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(getLocale())}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f9fafb" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <!--[if (gte mso 9)|(IE)]>
        <table width="600" align="center" border="0" cellspacing="0" cellpadding="0" style="width: 600px;">
          <tr>
            <td>
        <![endif]-->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb;" bgcolor="#ffffff">
          <tr>
            <td style="padding: 32px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #1f2937;">
              ${contentHtml}
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`
}
