import LegalPageLayout from '#/components/LegalPageLayout'
import { m } from '#/paraglide/messages'

const LAST_UPDATED = '24 May 2026'

export default function TermsPage() {
  const sections = [
    {
      title: m.terms_section_1_title(),
      text: m.terms_section_1_text({ name: m.legal_operator_name() }),
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
      title: m.terms_section_16_title(),
      text: m.terms_section_16_text({ email: m.legal_contact_email() }),
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
