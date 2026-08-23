import { m } from '#/paraglide/messages'

/**
 * Reader for the DSA Article 17(3) payload that
 * `lib/shops/moderation.server.ts` writes onto `shop_moderation_update`
 * notifications and emails.
 *
 * The statement travels as structured data (measure discriminant, grounds kind,
 * redress routes) rather than pre-rendered text, so each surface renders it in
 * the recipient's locale. Field resolution lives here, once: the in-app card
 * (`components/notifications/ShopModerationNotice.tsx`) and the email template
 * (`lib/email/templates.ts`) must present the same elements, and a second
 * reader would let them drift.
 *
 * A reinstatement carries no Article 17 elements — the obligation attaches to
 * restrictions — so it resolves to `{ kind: 'reinstatement' }` and each surface
 * styles it as the good news it is. First-time activation shares that shape and
 * reads the same way, which is accurate for both events.
 */
export type ShopSuspensionMeasure = 'shop_suspended_listings_delisted'

/** Matches `StatementOfReasons`; the platform has no contact route. */
const SUPPORT_EMAIL_FALLBACK = 'support@eurtisan.eu'

/** Neutral Art. 17(3)(b) grounds key when no moderator note was recorded. */
const GROUNDS_GENERIC_KEY = 'dsa_sor_grounds_generic'

export interface ShopSuspensionSoR {
  /** Art. 17(3)(a): what was done, as the producer's measure discriminant. */
  measureKey: ShopSuspensionMeasure | null
  /**
   * Art. 17(3)(b): the recorded moderation note verbatim, or — when none was
   * recorded — the neutral generic grounds resolved through Paraglide.
   */
  grounds: string
  /** Internal complaint route; empty means the payload offered none. */
  supportEmail: string
  judicialRemedyAvailable: boolean
  automatedMeans: boolean
}

export type ShopModerationNotice =
  | { kind: 'suspension'; sor: ShopSuspensionSoR }
  | { kind: 'reinstatement' }

export function readShopModerationNotice(
  data: Record<string, unknown>,
): ShopModerationNotice | null {
  const status = typeof data.status === 'string' ? data.status : ''
  if (status === 'active') return { kind: 'reinstatement' }
  if (status !== 'suspended') return null

  // Grounds exist only for a restriction: the moderator's own words verbatim
  // when one was recorded, otherwise the neutral generic grounds message the
  // producer names by key.
  const grounds =
    typeof data.note === 'string' && data.note.trim()
      ? data.note
      : data.groundsKey === GROUNDS_GENERIC_KEY
        ? m.dsa_sor_grounds_generic()
        : ''

  const supportEmail =
    typeof data.redressSupportEmail === 'string' && data.redressSupportEmail.trim()
      ? data.redressSupportEmail.trim()
      : SUPPORT_EMAIL_FALLBACK

  return {
    kind: 'suspension',
    sor: {
      measureKey:
        data.measure === 'shop_suspended_listings_delisted'
          ? 'shop_suspended_listings_delisted'
          : null,
      grounds,
      supportEmail,
      judicialRemedyAvailable: data.judicialRemedyAvailable === true,
      automatedMeans: data.automatedMeans === true,
    },
  }
}
