import { describe, expect, it } from 'vitest'
import {
  getProductImageTransitionName,
  getShopImageTransitionName,
  resolveNavigationTransitionTypes,
} from './view-transitions'

describe('navigation view transitions', () => {
  it('uses the page transition for ordinary pathname changes', () => {
    expect(
      resolveNavigationTransitionTypes({
        pathChanged: true,
        fromPathname: '/',
        toPathname: '/about',
      }),
    ).toEqual(['page'])
  })

  it('does not animate search or hash-only navigation', () => {
    expect(
      resolveNavigationTransitionTypes({
        pathChanged: false,
        fromPathname: '/search',
        toPathname: '/search',
      }),
    ).toBe(false)
  })

  it('uses forward motion when advancing through one onboarding draft', () => {
    expect(
      resolveNavigationTransitionTypes({
        pathChanged: true,
        fromPathname: '/sell/onboarding/draft-1/identity',
        toPathname: '/sell/onboarding/draft-1/visuals',
      }),
    ).toEqual(['onboarding-forward'])
  })

  it('uses backward motion when returning through one onboarding draft', () => {
    expect(
      resolveNavigationTransitionTypes({
        pathChanged: true,
        fromPathname: '/sell/onboarding/draft-1/review',
        toPathname: '/sell/onboarding/draft-1/policies',
      }),
    ).toEqual(['onboarding-backward'])
  })

  it('keeps ordinary page motion when entering a different onboarding draft', () => {
    expect(
      resolveNavigationTransitionTypes({
        pathChanged: true,
        fromPathname: '/sell/onboarding/draft-1/story',
        toPathname: '/sell/onboarding/draft-2/visuals',
      }),
    ).toEqual(['page'])
  })

  it('provides stable entity image names for shared-element transitions', () => {
    expect(getProductImageTransitionName('product-1')).toBe('product-image-product-1')
    expect(getShopImageTransitionName('shop-1')).toBe('shop-image-shop-1')
  })
})
