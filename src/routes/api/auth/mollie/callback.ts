import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { shop } from '#/db/schema'
import { verifyMollieState } from '#/lib/auth-utils'
import { auth } from '#/lib/auth'

export const Route = createFileRoute('/api/auth/mollie/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')

        if (!code || !state) {
          return new Response(
            JSON.stringify({ error: 'Bad Request', message: 'Missing OAuth code or state.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // Get the authenticated session
        const sessionResult = await auth.api.getSession({ headers: request.headers })
        if (!sessionResult?.user) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized', message: 'Authentication required.' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          )
        }
        const userId = sessionResult.user.id

        // Cryptographically verify the state parameter
        const shopId = verifyMollieState(state, userId)
        if (!shopId) {
          return new Response(
            JSON.stringify({ error: 'Forbidden', message: 'Invalid or expired OAuth state.' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // Verify the user owns the shop (or is admin)
        const shopRecord = await db.query.shop.findFirst({
          where: eq(shop.id, shopId),
        })

        if (!shopRecord) {
          return new Response(JSON.stringify({ error: 'Not Found', message: 'Shop not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const userRole = (sessionResult.user as unknown as { role?: string }).role
        if (shopRecord.ownerId !== userId && userRole !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Forbidden', message: 'You do not own this shop.' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
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
          .where(eq(shop.id, shopId))

        // Redirect back to payouts dashboard
        return new Response(null, {
          status: 302,
          headers: {
            Location: `/creator/payouts?shopId=${encodeURIComponent(shopId)}&success=mollie_connected`,
          },
        })
      },
    },
  },
})
