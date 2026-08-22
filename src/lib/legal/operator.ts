import { createServerFn } from '@tanstack/react-start'

export interface PublicOperatorProfile {
  name: string
  email: string
  vatId: string
  registrationNumber: string
  publicationDirector: string
  hostingProvider: string
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
      registrationNumber: op.registrationNumber,
      publicationDirector: op.publicationDirector,
      hostingProvider: op.hostingProvider,
      formattedAddress: op.formattedAddress,
    }
  },
)
