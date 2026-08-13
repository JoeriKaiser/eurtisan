import LegalPageLayout from '#/components/LegalPageLayout'
import { m } from '#/paraglide/messages'
import type { PublicOperatorProfile } from '#/lib/legal/operator'

const LAST_UPDATED = '13 July 2026'

export interface PrivacyPageProps {
  operator?: PublicOperatorProfile
}

export default function PrivacyPage({ operator }: PrivacyPageProps = {}) {
  const operatorName = operator?.name || m.legal_operator_name()
  const operatorAddress = operator?.formattedAddress || m.legal_operator_address()
  const contactEmail = operator?.email || m.legal_contact_email()
  const vatNumber = operator?.vatId || m.legal_vat_number()

  const sections = [
    { title: m.privacy_section_1_title(), text: m.privacy_section_1_text() },
    {
      title: m.privacy_section_2_title(),
      text: m.privacy_section_2_text({
        name: operatorName,
        address: operatorAddress,
        email: contactEmail,
        vat: vatNumber,
      }),
    },
    { title: m.privacy_section_3_title(), text: m.privacy_section_3_text() },
    { title: m.privacy_section_4_title(), text: m.privacy_section_4_text() },
    { title: m.privacy_section_5_title(), text: m.privacy_section_5_text() },
    { title: m.privacy_section_6_title(), text: m.privacy_section_6_text() },
    { title: m.privacy_section_7_title(), text: m.privacy_section_7_text() },
    { title: m.privacy_section_8_title(), text: m.privacy_section_8_text() },
    { title: m.privacy_section_9_title(), text: m.privacy_section_9_text() },
    {
      title: m.privacy_section_10_title(),
      text: m.privacy_section_10_text({ email: contactEmail }),
    },
    { title: m.privacy_section_11_title(), text: m.privacy_section_11_text() },
    { title: m.privacy_section_12_title(), text: m.privacy_section_12_text() },
    { title: m.privacy_section_13_title(), text: m.privacy_section_13_text() },
    {
      title: m.privacy_section_14_title(),
      text: m.privacy_section_14_text({ email: contactEmail }),
    },
    {
      title: m.privacy_dpo_title(),
      text: m.privacy_dpo_text({ email: contactEmail }),
    },
  ]

  return (
    <LegalPageLayout
      kicker={m.privacy_kicker()}
      title={m.privacy_title()}
      lastUpdated={m.legal_last_updated({ date: LAST_UPDATED })}
      sections={sections}
    />
  )
}
