import LegalPageLayout from '#/components/LegalPageLayout'
import { m } from '#/paraglide/messages'
import type { PublicOperatorProfile } from '#/lib/legal/operator'

const LAST_UPDATED = '23 August 2026'

export interface ImprintPageProps {
  operator?: PublicOperatorProfile
}

export default function ImprintPage({ operator }: ImprintPageProps = {}) {
  const operatorName = operator?.name || m.legal_operator_name()
  const contactEmail = operator?.email || m.legal_contact_email()
  const registrationNumber =
    operator?.registrationNumber || 'RCS Paris 000 000 000 / SIRET 00000000000000'
  const vatId = operator?.vatId || m.legal_vat_number()
  const formattedAddress =
    operator?.formattedAddress || '1 Place de la République, 75001 Paris, France'
  const publicationDirector = operator?.publicationDirector || 'Directeur de la publication'
  const hostingProvider =
    operator?.hostingProvider ||
    'Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany'

  const sections = [
    {
      title: m.imprint_section_operator_title(),
      text: m.imprint_section_operator_text({
        name: operatorName,
        registrationNumber,
        address: formattedAddress,
        vatId,
        email: contactEmail,
      }),
    },
    {
      title: m.imprint_section_publishing_title(),
      text: m.imprint_section_publishing_text({
        publicationDirector,
      }),
    },
    {
      title: m.imprint_section_hosting_title(),
      text: m.imprint_section_hosting_text({
        hostingProvider,
      }),
    },
    {
      title: m.imprint_section_contact_title(),
      text: m.imprint_section_contact_text({
        email: contactEmail,
      }),
    },
  ]

  return (
    <LegalPageLayout
      kicker={m.imprint_kicker()}
      title={m.imprint_title()}
      lastUpdated={m.legal_last_updated({ date: LAST_UPDATED })}
      sections={sections}
    />
  )
}
