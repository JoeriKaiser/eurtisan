import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { MollieMockOauth } from '#/route-components/mollie-mock-oauth'

export const Route = createFileRoute('/mollie-mock-oauth')({
  validateSearch: z.object({
    shopId: z.string(),
    redirect_uri: z.string(),
  }),
  component: MollieMockOauth,
})
