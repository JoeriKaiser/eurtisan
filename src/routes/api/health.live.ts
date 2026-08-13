import { createFileRoute } from '@tanstack/react-router'

import { checkLive } from './health'

export const Route = createFileRoute('/api/health/live')({
  server: {
    handlers: {
      GET: () => {
        const { body, status } = checkLive()
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
