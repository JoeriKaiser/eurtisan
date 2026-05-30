import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

export type {
  CartDetail,
  CartItemDetail,
  CartProductDetail,
  CartShopGroup,
} from './cart.server'

export { ANONYMOUS_SESSION_COOKIE } from './cart-constants'

export const ensureAnonymousSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getAnonymousSessionIdFromCookie, setAnonymousSessionCookie, generateSessionId } =
    await import('./cart.server')
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
    const { getAnonymousSessionIdFromCookie, getCartDetailsByUserId, getCartDetailsBySessionId } =
      await import('./cart.server')
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
    const {
      AUTH_CART_DAYS,
      ANON_CART_DAYS,
      addItemToCart,
      createAnonymousCart,
      createUserCart,
      getAnonymousSessionIdFromCookie,
      getCartWithItemsBySessionId,
      getCartWithItemsByUserId,
      setAnonymousSessionCookie,
      touchCartExpiry,
      generateSessionId,
    } = await import('./cart.server')

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
    const {
      getAnonymousSessionIdFromCookie,
      getCartWithItemsByUserId,
      getCartWithItemsBySessionId,
      updateCartItemQuantity,
    } = await import('./cart.server')

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
    const {
      getAnonymousSessionIdFromCookie,
      getCartWithItemsByUserId,
      getCartWithItemsBySessionId,
      removeItemFromCart,
    } = await import('./cart.server')

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
    const {
      getAnonymousSessionIdFromCookie,
      clearAnonymousSessionCookie,
      mergeAnonymousCartIntoUserCart,
    } = await import('./cart.server')
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
    const { clearExpiredCarts } = await import('./cart.server')
    await clearExpiredCarts()
    return { success: true }
  })
