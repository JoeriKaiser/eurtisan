/**
 * Transactional email templates.
 *
 * Each template returns an HTML body, a plain-text body, and a subject line.
 * Render errors are caught by the caller so a plain-text fallback can be sent.
 */

import type { EmailTemplate } from './email-provider'

/** Result of rendering a template. */
export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/** Render a template with the given data. Throws on missing required fields. */
export function renderTemplate(
  template: EmailTemplate,
  data: Record<string, unknown>,
): RenderedEmail {
  switch (template) {
    case 'order_confirmation':
      return renderOrderConfirmation(data)
    case 'shipping_notification':
      return renderShippingNotification(data)
    case 'dispute_update':
      return renderDisputeUpdate(data)
    case 'email_verification':
      return renderEmailVerification(data)
    case 'password_reset':
      return renderPasswordReset(data)
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

function renderOrderConfirmation(data: Record<string, unknown>): RenderedEmail {
  const orderNumber = String(data.orderNumber ?? '—')
  const buyerName = String(data.buyerName ?? 'Valued Customer')
  const shopName = String(data.shopName ?? 'Eurtisan')
  const items = Array.isArray(data.items) ? data.items : []
  const total = String(data.total ?? '—')
  const orderUrl = String(data.orderUrl ?? '')

  const itemsListHtml = items
    .map((item: unknown) => {
      if (typeof item !== 'object' || item === null) return ''
      const i = item as Record<string, unknown>
      const name = String(i.name ?? 'Item')
      const quantity = Number(i.quantity ?? 1)
      const price = String(i.price ?? '—')
      return `<li>${escapeHtml(name)} — Qty ${quantity} — ${escapeHtml(price)}</li>`
    })
    .join('')

  const itemsListText = items
    .map((item: unknown) => {
      if (typeof item !== 'object' || item === null) return ''
      const i = item as Record<string, unknown>
      const name = String(i.name ?? 'Item')
      const quantity = Number(i.quantity ?? 1)
      const price = String(i.price ?? '—')
      return `- ${name} — Qty ${quantity} — ${price}`
    })
    .join('\n')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">Thank you for your order, ${escapeHtml(buyerName)}!</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">Your order <strong>#${escapeHtml(orderNumber)}</strong> from <strong>${escapeHtml(shopName)}</strong> has been received and is being prepared.</div>
  <br />
  <div style="font-weight: 600; color: #111827; font-size: 16px; line-height: 1.5;">Items:</div>
  <ul style="padding-left: 20px; color: #374151; font-size: 16px; line-height: 1.5;">${itemsListHtml}</ul>
  <br />
  <div style="font-weight: 600; color: #111827; font-size: 16px; line-height: 1.5;">Total: ${escapeHtml(total)}</div>
  ${orderUrl ? `<br /><div style="font-size: 16px; line-height: 1.5;"><a href="${escapeHtml(orderUrl)}" style="color: #2563eb; text-decoration: underline;">View your order</a></div>` : ''}
  <br /><br />
  <div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    Eurtisan — Empowering European artisans and their communities.
  </div>`

  const html = wrapInEmailTemplate('Order Confirmation', contentHtml)

  const text = `Thank you for your order, ${buyerName}!

Your order #${orderNumber} from ${shopName} has been received and is being prepared.

Items:
${itemsListText || '- No items'}

Total: ${total}
${orderUrl ? `View your order: ${orderUrl}` : ''}

Eurtisan — Empowering European artisans and their communities.`

  return { subject: `Order Confirmation #${orderNumber} — ${shopName}`, html, text }
}

/* -------------------------------------------------------------------------- */
/*                          Shipping Notification                             */
/* -------------------------------------------------------------------------- */

function renderShippingNotification(data: Record<string, unknown>): RenderedEmail {
  const orderNumber = String(data.orderNumber ?? '—')
  const buyerName = String(data.buyerName ?? 'Valued Customer')
  const shopName = String(data.shopName ?? 'Eurtisan')
  const trackingNumber = String(data.trackingNumber ?? '—')
  const carrier = String(data.carrier ?? '—')
  const estimatedDelivery = String(data.estimatedDelivery ?? '—')
  const trackingUrl = String(data.trackingUrl ?? '')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">Your order is on its way, ${escapeHtml(buyerName)}!</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">Your order <strong>#${escapeHtml(orderNumber)}</strong> from <strong>${escapeHtml(shopName)}</strong> has been shipped.</div>
  <br />
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; width: 100%;" bgcolor="#f9fafb">
    <tr>
      <td style="padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #374151;">
        <div><strong>Carrier:</strong> ${escapeHtml(carrier)}</div>
        <br />
        <div><strong>Tracking number:</strong> ${escapeHtml(trackingNumber)}</div>
        <br />
        <div><strong>Estimated delivery:</strong> ${escapeHtml(estimatedDelivery)}</div>
      </td>
    </tr>
  </table>
  ${trackingUrl ? `<br /><div style="font-size: 16px; line-height: 1.5;"><a href="${escapeHtml(trackingUrl)}" style="color: #2563eb; text-decoration: underline;">Track your shipment</a></div>` : ''}
  <br /><br />
  <div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    Eurtisan — Empowering European artisans and their communities.
  </div>`

  const html = wrapInEmailTemplate('Shipping Notification', contentHtml)

  const text = `Your order is on its way, ${buyerName}!

Your order #${orderNumber} from ${shopName} has been shipped.

Carrier: ${carrier}
Tracking number: ${trackingNumber}
Estimated delivery: ${estimatedDelivery}
${trackingUrl ? `Track your shipment: ${trackingUrl}` : ''}

Eurtisan — Empowering European artisans and their communities.`

  return { subject: `Your order #${orderNumber} has shipped — ${shopName}`, html, text }
}

/* -------------------------------------------------------------------------- */
/*                             Dispute Update                                 */
/* -------------------------------------------------------------------------- */

function renderDisputeUpdate(data: Record<string, unknown>): RenderedEmail {
  const orderNumber = String(data.orderNumber ?? '—')
  const buyerName = String(data.buyerName ?? 'Valued Customer')
  const shopName = String(data.shopName ?? 'Eurtisan')
  const status = String(data.status ?? 'updated')
  const message = String(data.message ?? '')
  const disputeUrl = String(data.disputeUrl ?? '')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">Dispute update for order #${escapeHtml(orderNumber)}</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">Hi ${escapeHtml(buyerName)},</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">There is an update regarding the dispute for your order <strong>#${escapeHtml(orderNumber)}</strong> from <strong>${escapeHtml(shopName)}</strong>.</div>
  <br />
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; width: 100%;" bgcolor="#f9fafb">
    <tr>
      <td style="padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.5; color: #111827; font-weight: 600;">
        Status: ${escapeHtml(status)}
      </td>
    </tr>
  </table>
  ${message ? `<br /><div style="color: #374151; font-size: 16px; line-height: 1.5;">${escapeHtml(message)}</div>` : ''}
  ${disputeUrl ? `<br /><div style="font-size: 16px; line-height: 1.5;"><a href="${escapeHtml(disputeUrl)}" style="color: #2563eb; text-decoration: underline;">View dispute details</a></div>` : ''}
  <br /><br />
  <div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    Eurtisan — Empowering European artisans and their communities.
  </div>`

  const html = wrapInEmailTemplate('Dispute Update', contentHtml)

  const text = `Dispute update for order #${orderNumber}

Hi ${buyerName},

There is an update regarding the dispute for your order #${orderNumber} from ${shopName}.

Status: ${status}
${message ? `\n${message}` : ''}
${disputeUrl ? `\nView dispute details: ${disputeUrl}` : ''}

Eurtisan — Empowering European artisans and their communities.`

  return { subject: `Dispute update for order #${orderNumber} — ${shopName}`, html, text }
}

/* -------------------------------------------------------------------------- */
/*                            Email Verification                              */
/* -------------------------------------------------------------------------- */

function renderEmailVerification(data: Record<string, unknown>): RenderedEmail {
  const userName = String(data.userName ?? 'Valued Customer')
  const verificationUrl = String(data.verificationUrl ?? '')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">Verify your email address</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">Hi ${escapeHtml(userName)},</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">Thank you for signing up for Eurtisan! Please verify your email address to complete your account setup.</div>
  <br />
  <table border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" bgcolor="#2563eb" style="border-radius: 6px; padding: 12px 24px;">
        <a href="${escapeHtml(verificationUrl)}" target="_blank" style="color: #ffffff; text-decoration: none; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px;">Verify Email Address</a>
      </td>
    </tr>
  </table>
  <br />
  <div style="color: #374151; font-size: 14px; line-height: 1.5;">If the button doesn't work, you can copy and paste the following link into your browser:</div>
  <br />
  <div style="font-size: 14px; line-height: 1.5;"><a href="${escapeHtml(verificationUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(verificationUrl)}</a></div>
  <br /><br />
  <div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    Eurtisan — Empowering European artisans and their communities.
  </div>`

  const html = wrapInEmailTemplate('Verify your email address', contentHtml)

  const text = `Verify your email address

Hi ${userName},

Thank you for signing up for Eurtisan! Please verify your email address to complete your account setup.

Verify Email Address: ${verificationUrl}

Eurtisan — Empowering European artisans and their communities.`

  return { subject: 'Verify your Eurtisan account', html, text }
}

/* -------------------------------------------------------------------------- */
/*                            Password Reset                                  */
/* -------------------------------------------------------------------------- */

function renderPasswordReset(data: Record<string, unknown>): RenderedEmail {
  const userName = String(data.userName ?? 'Valued Customer')
  const resetUrl = String(data.resetUrl ?? '')

  const contentHtml = `<div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">Reset your password</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">Hi ${escapeHtml(userName)},</div>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">We received a request to reset the password for your Eurtisan account. Click the button below to choose a new password.</div>
  <br />
  <table border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" bgcolor="#2563eb" style="border-radius: 6px; padding: 12px 24px;">
        <a href="${escapeHtml(resetUrl)}" target="_blank" style="color: #ffffff; text-decoration: none; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px;">Reset Password</a>
      </td>
    </tr>
  </table>
  <br />
  <div style="color: #374151; font-size: 16px; line-height: 1.5;">If you did not request this, you can safely ignore this email.</div>
  <br />
  <div style="color: #374151; font-size: 14px; line-height: 1.5;">If the button doesn't work, you can copy and paste the following link into your browser:</div>
  <br />
  <div style="font-size: 14px; line-height: 1.5;"><a href="${escapeHtml(resetUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(resetUrl)}</a></div>
  <br /><br />
  <div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    Eurtisan — Empowering European artisans and their communities.
  </div>`

  const html = wrapInEmailTemplate('Reset your password', contentHtml)

  const text = `Reset your password

Hi ${userName},

We received a request to reset the password for your Eurtisan account. Click the link below to choose a new password.

Reset Password: ${resetUrl}

If you did not request this, you can safely ignore this email.

Eurtisan — Empowering European artisans and their communities.`

  return { subject: 'Reset your Eurtisan password', html, text }
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
<html lang="en">
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
