import { createServerFn } from '@tanstack/react-start'

export interface PublicOperatorProfile {
  name: string
  email: string
  vatId: string
  formattedAddress: string
  /** French legal form (e.g. 'SAS'). Unset when not configured. */
  legalForm?: string | undefined
  /** Declared share capital. Optional even in production. */
  shareCapital?: string | undefined
  /** SIREN identifier (9 digits). Unset when not configured. */
  siren?: string | undefined
  /** SIRET identifier (14 digits). Unset when not configured. */
  siret?: string | undefined
  /** City of RCS registration. Unset when not configured. */
  rcsCity?: string | undefined
  /** Publication director named on the imprint. Unset when not configured. */
  publicationDirector?: string | undefined
  /** Hosting provider details required by LCEN Art. 6-III 2°. */
  hosting?:
    | {
        name: string
        address: string | undefined
        phone: string | undefined
      }
    | undefined
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
      legalForm: op.legalForm,
      shareCapital: op.shareCapital,
      siren: op.siren,
      siret: op.siret,
      rcsCity: op.rcsCity,
      publicationDirector: op.publicationDirector,
      hosting: op.hosting,
    }
  },
)
