// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ReportReviewDialog } from './ReportReviewDialog'

vi.mock('#/paraglide/messages', () => {
  const explicit: Record<string, unknown> = {
    review_report_title: () => 'Report this review',
    review_report_description: () => 'A moderator reviews every report.',
    review_report_reason_label: () => 'Reason',
    review_report_reason_not_authentic: () => 'I doubt this is from a real buyer',
    review_report_reason_offensive: () => 'Offensive or abusive',
    review_report_reason_spam: () => 'Spam or advertising',
    review_report_reason_personal_data: () => "Contains someone's personal details",
    review_report_reason_other: () => 'Something else',
    review_report_details_label: () => 'What is wrong?',
    review_report_details_placeholder: () => 'Add anything that helps.',
    review_report_submit: () => 'Send report',
    confirm_dialog_cancel: () => 'Cancel',
  }

  return {
    m: new Proxy(explicit, { get: (target, key: string) => target[key] ?? (() => key) }),
  }
})

function renderDialog(props: Partial<React.ComponentProps<typeof ReportReviewDialog>> = {}) {
  const onSubmit = vi.fn()
  const onOpenChange = vi.fn()
  render(<ReportReviewDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} {...props} />)
  return { onSubmit, onOpenChange }
}

describe('ReportReviewDialog', () => {
  it('offers the authenticity ground first', () => {
    // C. consom. L.111-7-2 obliges a free route to flag a doubt about
    // authenticity, so it leads rather than hiding under "other".
    renderDialog()
    const radios = screen.getAllByRole('radio')
    expect(radios[0].getAttribute('value')).toBe('not_authentic')
  })

  it('sends the chosen ground with the notice', () => {
    const { onSubmit } = renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: 'Spam or advertising' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

    expect(onSubmit).toHaveBeenCalledWith('spam', null)
  })

  it('passes the explanation through', () => {
    const { onSubmit } = renderDialog()

    fireEvent.change(screen.getByLabelText('What is wrong?'), {
      target: { value: '  names another customer  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

    expect(onSubmit).toHaveBeenCalledWith('not_authentic', 'names another customer')
  })

  it('will not send "something else" with nothing else', () => {
    // DSA Article 16(2)(a) wants a substantiated explanation; the bare label
    // "something else" substantiates nothing.
    const { onSubmit } = renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }))
    const submit = screen.getByRole('button', { name: 'Send report' })
    expect(submit.hasAttribute('disabled')).toBe(true)

    fireEvent.click(submit)
    expect(onSubmit).not.toHaveBeenCalled()

    // The label gains a required marker once "other" is chosen, so match loosely.
    fireEvent.change(screen.getByLabelText(/What is wrong\?/), { target: { value: 'a reason' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
    expect(onSubmit).toHaveBeenCalledWith('other', 'a reason')
  })

  it('blocks a second submission while one is in flight', () => {
    const { onSubmit } = renderDialog({ busy: true })
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('announces a failure rather than failing silently', () => {
    renderDialog({ error: 'We could not send your report.' })
    expect(screen.getByRole('alert').textContent).toContain('We could not send your report.')
  })

  it('has no axe violations', async () => {
    render(<ReportReviewDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />)
    // Scans the dialog rather than the whole document, matching
    // `ui/primitives/accessibility.test.tsx`: the popup renders through a portal
    // flanked by the library's own focus guards, which are not our markup.
    const dialog = await screen.findByRole('dialog')
    expect(await axe(dialog)).toHaveNoViolations()
  })
})
