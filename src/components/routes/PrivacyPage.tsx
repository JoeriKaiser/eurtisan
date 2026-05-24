import LegalPageLayout from '#/components/LegalPageLayout'
import { m } from '#/paraglide/messages'

const LAST_UPDATED = '24 May 2026'

export default function PrivacyPage() {
  const sections = [
    { title: m.privacy_section_1_title(), text: m.privacy_section_1_text() },
    {
      title: m.privacy_section_2_title(),
      text: m.privacy_section_2_text({
        name: m.legal_operator_name(),
        address: m.legal_operator_address(),
        email: m.legal_contact_email(),
        vat: m.legal_vat_number(),
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
      text: m.privacy_section_10_text({ email: m.legal_contact_email() }),
    },
    { title: m.privacy_section_11_title(), text: m.privacy_section_11_text() },
    { title: m.privacy_section_12_title(), text: m.privacy_section_12_text() },
    { title: m.privacy_section_13_title(), text: m.privacy_section_13_text() },
    {
      title: m.privacy_section_14_title(),
      text: m.privacy_section_14_text({ email: m.legal_contact_email() }),
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
