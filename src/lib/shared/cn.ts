/**
 * Simple className merger. Merges tailwind classes without external deps.
 * For production scale, consider `clsx` + `tailwind-merge`.
 */
export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}
