export const SELL_ONBOARDING_STEPS = [
  { id: 1, nameKey: 'profile', path: 'identity' },
  { id: 2, nameKey: 'seller', path: 'location' },
  { id: 3, nameKey: 'product', path: 'listing' },
  { id: 4, nameKey: 'delivery', path: 'policies' },
  { id: 5, nameKey: 'review', path: 'review' },
] as const

export const SELL_ONBOARDING_STAGE_COUNT = SELL_ONBOARDING_STEPS.length

export type SellOnboardingStage = (typeof SELL_ONBOARDING_STEPS)[number]['id']

export function normalizeOnboardingStage(stage: number): SellOnboardingStage {
  if (stage <= 1) return 1
  if (stage >= SELL_ONBOARDING_STAGE_COUNT) return SELL_ONBOARDING_STAGE_COUNT
  return stage as SellOnboardingStage
}
