import { createFileRoute } from '@tanstack/react-router'

import { unsubscribeByToken } from '#/lib/email-preferences.server'

export const Route = createFileRoute('/api/unsubscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData()
        const token = String(form.get('token') ?? '')
        const rawCategory = String(form.get('category') ?? '')
        const category =
          rawCategory === 'seller_updates' ||
          rawCategory === 'marketing' ||
          rawCategory === 'platform_announcements'
            ? rawCategory
            : undefined
        const result = await unsubscribeByToken(token, category)
        return new Response(null, { status: result.success ? 200 : 400 })
      },
    },
  },
})
