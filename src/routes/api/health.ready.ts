import { createFileRoute } from '@tanstack/react-router'

import { checkReady } from './health'

export const Route = createFileRoute('/api/health/ready')({
  server: {
    handlers: {
      GET: async () => {
        const { body, status } = await checkReady()
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
