import { createServerFn } from '@tanstack/react-start'

export interface PublicOperatorProfile {
  name: string
  email: string
  vatId: string
  formattedAddress: string
}

/**
 * Server function to fetch public legal operator information for SSR legal pages.
 */
export const getPublicOperatorProfile = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PublicOperatorProfile> => {
    const { getOperatorProfile } = await import('./operator.server')
    const op = getOperatorProfile()
    return {
      name: op.name,
      email: op.email,
      vatId: op.vatId,
      formattedAddress: op.formattedAddress,
    }
  },
)
