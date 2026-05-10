import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'
import { authMiddleware } from './auth-middleware'
import {
  ANONYMOUS_SESSION_COOKIE,
  AUTH_CART_DAYS,
  addItemToCart,
  clearExpiredCarts,
  createAnonymousCart,
  createUserCart,
  generateSessionId,
  getCartDetailsBySessionId,
  getCartDetailsByUserId,
  getCartWithItemsBySessionId,
  getCartWithItemsByUserId,
  mergeAnonymousCartIntoUserCart,
  removeItemFromCart,
  touchCartExpiry,
  updateCartItemQuantity,
} from './cart.server'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  path: '/',
}

export function getAnonymousSessionIdFromCookie(): string | undefined {
  return getCookie(ANONYMOUS_SESSION_COOKIE) ?? undefined
}

export function setAnonymousSessionCookie(sessionId: string): void {
  setCookie(ANONYMOUS_SESSION_COOKIE, sessionId, COOKIE_OPTIONS)
}

export function clearAnonymousSessionCookie(): void {
  setCookie(ANONYMOUS_SESSION_COOKIE, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  })
}

export const ensureAnonymousSession = createServerFn({ method: 'GET' }).handler(async () => {
  const existing = getAnonymousSessionIdFromCookie()
  if (existing) {
    return { sessionId: existing }
  }
  const sessionId = generateSessionId()
  setAnonymousSessionCookie(sessionId)
  // Cart rows are created lazily when items are first added
  return { sessionId }
})

export const getCart = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (context.user) {
      return getCartDetailsByUserId(context.user.id)
    }
    const sessionId = getAnonymousSessionIdFromCookie()
    if (!sessionId) return null
    return getCartDetailsBySessionId(sessionId)
  })

export const addToCart = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (context.user) {
      const userCart = await getCartWithItemsByUserId(context.user.id)
      const cartId = userCart ? userCart.id : (await createUserCart(context.user.id)).id
      const result = await addItemToCart(cartId, data.productId, data.quantity)
      await touchCartExpiry(cartId, AUTH_CART_DAYS)
      return result
    }

    let sessionId = getAnonymousSessionIdFromCookie()
    if (!sessionId) {
      sessionId = generateSessionId()
      setAnonymousSessionCookie(sessionId)
    }

    const anonCart = await getCartWithItemsBySessionId(sessionId)
    const cartId = anonCart ? anonCart.id : (await createAnonymousCart(sessionId)).id
    const result = await addItemToCart(cartId, data.productId, data.quantity)
    await touchCartExpiry(cartId, ANON_CART_DAYS)
    return result
  })

export const updateCartItem = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(0),
    }),
  )
  .handler(async ({ context, data }) => {
    if (context.user) {
      const userCart = await getCartWithItemsByUserId(context.user.id)
      if (!userCart) {
        throw new Error('CART_NOT_FOUND')
      }
      return updateCartItemQuantity(userCart.id, data.productId, data.quantity)
    }

    const sessionId = getAnonymousSessionIdFromCookie()
    if (!sessionId) {
      throw new Error('CART_NOT_FOUND')
    }
    const anonCart = await getCartWithItemsBySessionId(sessionId)
    if (!anonCart) {
      throw new Error('CART_NOT_FOUND')
    }
    return updateCartItemQuantity(anonCart.id, data.productId, data.quantity)
  })

export const removeCartItem = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      productId: z.string().min(1),
    }),
  )
  .handler(async ({ context, data }) => {
    if (context.user) {
      const userCart = await getCartWithItemsByUserId(context.user.id)
      if (!userCart) {
        throw new Error('CART_NOT_FOUND')
      }
      await removeItemFromCart(userCart.id, data.productId)
      return { success: true }
    }

    const sessionId = getAnonymousSessionIdFromCookie()
    if (!sessionId) {
      throw new Error('CART_NOT_FOUND')
    }
    const anonCart = await getCartWithItemsBySessionId(sessionId)
    if (!anonCart) {
      throw new Error('CART_NOT_FOUND')
    }
    await removeItemFromCart(anonCart.id, data.productId)
    return { success: true }
  })

export const mergeCartOnLogin = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }
    const sessionId = getAnonymousSessionIdFromCookie()
    if (sessionId) {
      await mergeAnonymousCartIntoUserCart(sessionId, context.user.id)
      clearAnonymousSessionCookie()
    }
    return { success: true }
  })

export const runClearExpiredCarts = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user || context.user.role !== 'admin') {
      throw new Error('FORBIDDEN')
    }
    await clearExpiredCarts()
    return { success: true }
  })
