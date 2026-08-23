import LegalPageLayout from '#/components/LegalPageLayout'
import { m } from '#/paraglide/messages'
import type { PublicOperatorProfile } from '#/lib/legal/operator'

/** Matches `OrderSuccessPage` and `StatementOfReasons`; the platform has no contact route. */
const SUPPORT_EMAIL = 'support@eurtisan.eu'

const LAST_UPDATED = '13 July 2026'

export interface TermsPageProps {
  operator?: PublicOperatorProfile
}

export default function TermsPage({ operator }: TermsPageProps = {}) {
  const operatorName = operator?.name || m.legal_operator_name()
  const contactEmail = operator?.email || m.legal_contact_email()

  const sections = [
    {
      title: m.terms_section_1_title(),
      text: m.terms_section_1_text({ name: operatorName }),
    },
    { title: m.terms_section_2_title(), text: m.terms_section_2_text() },
    { title: m.terms_section_3_title(), text: m.terms_section_3_text() },
    { title: m.terms_section_4_title(), text: m.terms_section_4_text() },
    { title: m.terms_section_5_title(), text: m.terms_section_5_text() },
    { title: m.terms_section_6_title(), text: m.terms_section_6_text() },
    { title: m.terms_section_7_title(), text: m.terms_section_7_text() },
    { title: m.terms_section_8_title(), text: m.terms_section_8_text() },
    { title: m.terms_section_9_title(), text: m.terms_section_9_text() },
    { title: m.terms_section_10_title(), text: m.terms_section_10_text() },
    { title: m.terms_section_11_title(), text: m.terms_section_11_text() },
    { title: m.terms_section_12_title(), text: m.terms_section_12_text() },
    { title: m.terms_section_13_title(), text: m.terms_section_13_text() },
    { title: m.terms_section_14_title(), text: m.terms_section_14_text() },
    {
      title: m.terms_section_15_title(),
      text: m.terms_section_15_text({ country: m.legal_governing_law() }),
    },
    {
      title: m.dsa_terms_moderation_title(),
      text: m.dsa_terms_moderation_text({ supportEmail: SUPPORT_EMAIL }),
    },
    {
      title: m.dsa_terms_contacts_title(),
      text: m.dsa_terms_contacts_text({
        legalEmail: contactEmail,
        supportEmail: SUPPORT_EMAIL,
      }),
    },
    {
      title: m.dsa_terms_micro_title(),
      text: m.dsa_terms_micro_text(),
    },
    {
      title: m.terms_section_16_title(),
      text: m.terms_section_16_text({ email: contactEmail }),
    },
  ]

  return (
    <LegalPageLayout
      kicker={m.terms_kicker()}
      title={m.terms_title()}
      lastUpdated={m.legal_last_updated({ date: LAST_UPDATED })}
      sections={sections}
    />
  )
}
