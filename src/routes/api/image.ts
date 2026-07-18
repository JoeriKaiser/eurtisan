import { createFileRoute } from '@tanstack/react-router'

import { createImageDeliveryResponse } from '#/lib/images/delivery.server'

export const Route = createFileRoute('/api/image')({
  server: {
    handlers: {
      GET: ({ request }) => createImageDeliveryResponse(request),
    },
  },
})
