import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { shop } from '#/db/schema'

export const Route = createFileRoute('/api/auth/mollie/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state') // shopId

        if (!code || !state) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Missing OAuth code or state.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const mollieClientId = process.env.MOLLIE_CLIENT_ID
        const mollieClientSecret = process.env.MOLLIE_CLIENT_SECRET
        const isMockMode = !mollieClientId || !mollieClientSecret

        let mollieAccountId = ''

        if (isMockMode) {
          // Mock mode: generate a dummy mollieAccountId
          mollieAccountId = `org_mock_${crypto.randomUUID().slice(0, 8)}`
        } else {
          // Real mode: Exchange the code for Mollie organization ID
          try {
            const { getBaseUrl } = await import('#/lib/env.server')
            const baseUrl = getBaseUrl()
            const redirectUri = `${baseUrl}/api/auth/mollie/callback`

            const response = await fetch('https://api.mollie.com/oauth2/tokens', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${mollieClientId}:${mollieClientSecret}`).toString('base64')}`,
              },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
              }),
            })

            if (!response.ok) {
              const errBody = await response.text()
              console.error('Mollie Connect OAuth exchange failed:', errBody)
              throw new Error('Mollie OAuth token exchange failed')
            }

            const data = (await response.json()) as { organization_id: string }
            mollieAccountId = data.organization_id
          } catch (err) {
            console.error('Mollie Connect OAuth exchange exception:', err)
            return new Response(
              JSON.stringify({
                error: 'Bad Gateway',
                message: 'Mollie connection exchange failed.',
              }),
              { status: 502, headers: { 'Content-Type': 'application/json' } },
            )
          }
        }

        // Update the shop's Mollie account details in the database
        await db
          .update(shop)
          .set({
            mollieAccountId,
            paymentConnected: true,
            paymentConnectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(shop.id, state))

        // Redirect back to payouts dashboard
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/creator/payouts?shopId=${encodeURIComponent(state)}&success=mollie_connected`,
          },
        })
      },
    },
  },
})
