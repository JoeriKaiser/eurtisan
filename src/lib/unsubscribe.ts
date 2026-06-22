import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

const unsubscribeSchema = z.object({
  token: z.string(),
  category: z.enum(['seller_updates', 'marketing', 'platform_announcements']).optional(),
})

export const unsubscribeByToken = createServerFn({ method: 'POST' })
  .inputValidator(unsubscribeSchema)
  .handler(async ({ data }) => {
    const { unsubscribeByToken: serverUnsubscribe } = await import('./email-preferences.server')
    return serverUnsubscribe(data.token, data.category)
  })
