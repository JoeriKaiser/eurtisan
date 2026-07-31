/**
 * Shortens a reviewer's name for public display: "Joeri Kaiser" → "Joeri K.".
 *
 * Reviews used to publish `user.name` in full. That is the name given at
 * sign-up, not a public identity anyone chose — a buyer writing a review had no
 * way to know their full name would be published against it. First name plus
 * initial is the common marketplace pattern and keeps the review readable as
 * coming from a person.
 *
 * Applied server-side so the full name never reaches the browser at all, rather
 * than in the component where it would still ship in the payload.
 *
 * Returns an empty string when there is no usable name, which the caller
 * renders as a localized fallback — this function stays pure and locale-free so
 * it can be tested as a pure function.
 */
export function formatReviewerName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''

  const [first, ...rest] = parts
  const last = rest.at(-1)
  if (!last) return first

  // `Array.from` rather than `charAt`: an initial can be an astral character,
  // and slicing by code unit would emit half a surrogate pair.
  const initial = Array.from(last)[0]
  return initial ? `${first} ${initial.toUpperCase()}.` : first
}
