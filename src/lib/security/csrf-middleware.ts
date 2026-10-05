import { createMiddleware } from '@tanstack/react-start'

export const csrfMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const { validateCsrf } = await import('./csrf')
    validateCsrf(request)
    return next()
  },
)
