import { createFileRoute } from '@tanstack/react-router'

import { checkDependencies } from './health'

export const Route = createFileRoute('/api/health/deps')({
  server: {
    handlers: {
      GET: async () => {
        const { body, status } = await checkDependencies()
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
