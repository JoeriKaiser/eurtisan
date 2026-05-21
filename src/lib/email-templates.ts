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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Order Confirmation</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { margin: 0 0 12px; }
    ul { padding-left: 20px; margin: 0 0 16px; }
    li { margin-bottom: 4px; }
    .total { font-weight: 600; margin-top: 8px; }
    .footer { font-size: 12px; color: #6b7280; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Thank you for your order, ${escapeHtml(buyerName)}!</h1>
  <p>Your order <strong>#${escapeHtml(orderNumber)}</strong> from <strong>${escapeHtml(shopName)}</strong> has been received and is being prepared.</p>
  <p><strong>Items:</strong></p>
  <ul>${itemsListHtml}</ul>
  <p class="total"><strong>Total: ${escapeHtml(total)}</strong></p>
  ${orderUrl ? `<p><a href="${escapeHtml(orderUrl)}">View your order</a></p>` : ''}
  <div class="footer">
    <p>Eurtisan — Empowering European artisans and their communities.</p>
  </div>
</body>
</html>`

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Shipping Notification</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { margin: 0 0 12px; }
    .details { background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    .details p { margin: 0 0 8px; }
    .details p:last-child { margin-bottom: 0; }
    .footer { font-size: 12px; color: #6b7280; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Your order is on its way, ${escapeHtml(buyerName)}!</h1>
  <p>Your order <strong>#${escapeHtml(orderNumber)}</strong> from <strong>${escapeHtml(shopName)}</strong> has been shipped.</p>
  <div class="details">
    <p><strong>Carrier:</strong> ${escapeHtml(carrier)}</p>
    <p><strong>Tracking number:</strong> ${escapeHtml(trackingNumber)}</p>
    <p><strong>Estimated delivery:</strong> ${escapeHtml(estimatedDelivery)}</p>
  </div>
  ${trackingUrl ? `<p><a href="${escapeHtml(trackingUrl)}">Track your shipment</a></p>` : ''}
  <div class="footer">
    <p>Eurtisan — Empowering European artisans and their communities.</p>
  </div>
</body>
</html>`

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dispute Update</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { margin: 0 0 12px; }
    .status { background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px; font-weight: 600; }
    .footer { font-size: 12px; color: #6b7280; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Dispute update for order #${escapeHtml(orderNumber)}</h1>
  <p>Hi ${escapeHtml(buyerName)},</p>
  <p>There is an update regarding the dispute for your order <strong>#${escapeHtml(orderNumber)}</strong> from <strong>${escapeHtml(shopName)}</strong>.</p>
  <div class="status">Status: ${escapeHtml(status)}</div>
  ${message ? `<p>${escapeHtml(message)}</p>` : ''}
  ${disputeUrl ? `<p><a href="${escapeHtml(disputeUrl)}">View dispute details</a></p>` : ''}
  <div class="footer">
    <p>Eurtisan — Empowering European artisans and their communities.</p>
  </div>
</body>
</html>`

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Verify your email address</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { margin: 0 0 12px; }
    .button-container { margin: 24px 0; }
    .button { background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 500; }
    .footer { font-size: 12px; color: #6b7280; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>Verify your email address</h1>
  <p>Hi ${escapeHtml(userName)},</p>
  <p>Thank you for signing up for Eurtisan! Please verify your email address to complete your account setup.</p>
  <div class="button-container">
    <a href="${escapeHtml(verificationUrl)}" class="button">Verify Email Address</a>
  </div>
  <p>If the button doesn't work, you can copy and paste the following link into your browser:</p>
  <p><a href="${escapeHtml(verificationUrl)}">${escapeHtml(verificationUrl)}</a></p>
  <div class="footer">
    <p>Eurtisan — Empowering European artisans and their communities.</p>
  </div>
</body>
</html>`

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reset your password</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { margin: 0 0 12px; }
    .button-container { margin: 24px 0; }
    .button { background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 500; }
    .footer { font-size: 12px; color: #6b7280; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>Reset your password</h1>
  <p>Hi ${escapeHtml(userName)},</p>
  <p>We received a request to reset the password for your Eurtisan account. Click the button below to choose a new password.</p>
  <div class="button-container">
    <a href="${escapeHtml(resetUrl)}" class="button">Reset Password</a>
  </div>
  <p>If you did not request this, you can safely ignore this email.</p>
  <p>If the button doesn't work, you can copy and paste the following link into your browser:</p>
  <p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
  <div class="footer">
    <p>Eurtisan — Empowering European artisans and their communities.</p>
  </div>
</body>
</html>`

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
