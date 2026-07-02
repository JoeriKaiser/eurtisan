/**
 * Mailpit helpers for E2E email flows.
 *
 * Requires the observability/Mailpit stack to be running (`make up`).
 * Auth-related specs should call `skipIfMailpitUnavailable()` at the top of
 * the test if the inbox cannot be reached.
 */

const MAILPIT_API_URL = process.env.MAILPIT_API_URL ?? 'http://localhost:8025/api/v1'

interface MailpitMessageSummary {
  ID: string
  To: Array<{ Address: string; Name: string }>
  Subject: string
}

interface MailpitMessage {
  ID: string
  To: Array<{ Address: string; Name: string }>
  Subject: string
  Text: string
  HTML: string
}

export async function isMailpitAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${MAILPIT_API_URL}/messages`, { method: 'GET' })
    return response.ok
  } catch {
    return false
  }
}

async function listMessages(): Promise<MailpitMessageSummary[]> {
  const response = await fetch(`${MAILPIT_API_URL}/messages`)
  if (!response.ok) {
    throw new Error(`Mailpit messages endpoint failed: ${response.status}`)
  }
  const data = (await response.json()) as { messages: MailpitMessageSummary[] }
  return data.messages ?? []
}

async function getMessage(messageId: string): Promise<MailpitMessage> {
  const response = await fetch(`${MAILPIT_API_URL}/message/${messageId}`)
  if (!response.ok) {
    throw new Error(`Mailpit message endpoint failed: ${response.status}`)
  }
  return (await response.json()) as MailpitMessage
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function messageMatches(message: MailpitMessageSummary, to: string, subjectContains: string | RegExp): boolean {
  const normalizedTo = normalizeEmail(to)
  const recipientMatch = message.To.some((recipient) => normalizeEmail(recipient.Address) === normalizedTo)
  const subjectMatch =
    typeof subjectContains === 'string'
      ? message.Subject.toLowerCase().includes(subjectContains.toLowerCase())
      : subjectContains.test(message.Subject)
  return recipientMatch && subjectMatch
}

/**
 * Fetch the most recent email sent to `to` whose subject contains `subjectContains`.
 * Throws if no matching message is found.
 */
export async function getLatestEmail(to: string, subjectContains: string | RegExp): Promise<MailpitMessage> {
  const messages = await listMessages()
  const match = messages.find((message) => messageMatches(message, to, subjectContains))
  if (!match) {
    throw new Error(`No email to ${to} with subject "${subjectContains}" found in Mailpit`)
  }
  return getMessage(match.ID)
}

const VERIFICATION_TOKEN_PATTERN = /[?&]token=([^&\s]+)/
const RESET_TOKEN_PATTERN = /\/reset-password\/([A-Za-z0-9_-]+)/

function extractTokenFromEmail(email: MailpitMessage, pattern: RegExp): string {
  const text = email.Text ?? email.HTML ?? ''
  const match = text.match(pattern)
  if (!match?.[1]) {
    throw new Error('Token not found in email body')
  }
  return decodeURIComponent(match[1])
}

export function extractVerificationToken(email: MailpitMessage): string {
  return extractTokenFromEmail(email, VERIFICATION_TOKEN_PATTERN)
}

export function extractPasswordResetToken(email: MailpitMessage): string {
  return extractTokenFromEmail(email, RESET_TOKEN_PATTERN)
}

/**
 * Delete all messages sent to a given address. Useful for cleaning up
 * between sign-up attempts.
 */
export async function clearInboxFor(to: string): Promise<void> {
  const messages = await listMessages()
  const normalizedTo = normalizeEmail(to)
  const ids = messages
    .filter((message) => message.To.some((recipient) => normalizeEmail(recipient.Address) === normalizedTo))
    .map((message) => message.ID)

  if (ids.length === 0) return

  const response = await fetch(`${MAILPIT_API_URL}/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  })
  if (!response.ok) {
    throw new Error(`Failed to clear Mailpit inbox for ${to}: ${response.status}`)
  }
}
