import { SELL_ONBOARDING_STEPS } from './sell-onboarding-steps'

const PAGE_TRANSITION_TYPE = 'page'
const ONBOARDING_FORWARD_TRANSITION_TYPE = 'onboarding-forward'
const ONBOARDING_BACKWARD_TRANSITION_TYPE = 'onboarding-backward'

interface NavigationTransitionInput {
  pathChanged: boolean
  fromPathname?: string
  toPathname: string
}

function getOnboardingStep(pathname: string | undefined) {
  if (!pathname) return undefined

  const match = pathname.match(/^\/sell\/onboarding\/([^/]+)\/([^/]+)\/?$/)
  if (!match) return undefined

  const stepIndex = SELL_ONBOARDING_STEPS.findIndex((step) => step.path === match[2])
  if (stepIndex < 0) return undefined

  return { draftId: match[1], stepIndex }
}

export function resolveNavigationTransitionTypes({
  pathChanged,
  fromPathname,
  toPathname,
}: NavigationTransitionInput): Array<string> | false {
  if (!pathChanged) return false

  const fromStep = getOnboardingStep(fromPathname)
  const toStep = getOnboardingStep(toPathname)

  if (fromStep && toStep && fromStep.draftId === toStep.draftId) {
    if (toStep.stepIndex > fromStep.stepIndex) return [ONBOARDING_FORWARD_TRANSITION_TYPE]
    if (toStep.stepIndex < fromStep.stepIndex) return [ONBOARDING_BACKWARD_TRANSITION_TYPE]
    return false
  }

  return [PAGE_TRANSITION_TYPE]
}

/**
 * `view-transition-class` shared by every product and shop image that carries a
 * per-entity `view-transition-name`. `styles.css` uses it to crop the morph when
 * the two boundaries have different aspect ratios, and to give images that exist
 * on only one side of a navigation the page-content timing.
 */
export const SHARED_IMAGE_TRANSITION_CLASS = 'shared-image'

export function getProductImageTransitionName(productId: string): string {
  return `product-image-${productId}`
}

export function getShopImageTransitionName(shopId: string): string {
  return `shop-image-${shopId}`
}
