import LegalPageLayout from '#/components/LegalPageLayout'
import { m } from '#/paraglide/messages'

const LAST_UPDATED = '24 May 2026'

const sections = [
  { title: m.cookies_section_1_title(), text: m.cookies_section_1_text() },
  { title: m.cookies_section_2_title(), text: m.cookies_section_2_text() },
  { title: m.cookies_section_3_title(), text: m.cookies_section_3_text() },
  { title: m.cookies_section_4_title(), text: m.cookies_section_4_text() },
  { title: m.cookies_section_5_title(), text: m.cookies_section_5_text() },
  { title: m.cookies_section_6_title(), text: m.cookies_section_6_text() },
  { title: m.cookies_section_7_title(), text: m.cookies_section_7_text() },
  {
    title: m.cookies_section_8_title(),
    text: m.cookies_section_8_text({ email: m.legal_contact_email() }),
  },
]

export default function CookiesPage() {
  return (
    <LegalPageLayout
      kicker={m.cookies_kicker()}
      title={m.cookies_title()}
      lastUpdated={m.legal_last_updated({ date: LAST_UPDATED })}
      sections={sections}
    />
  )
}
