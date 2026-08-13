// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ReportSellerReplyDialog } from './ReportSellerReplyDialog'

vi.mock('#/paraglide/messages', () => {
  const explicit: Record<string, unknown> = {
    seller_reply_report_title: () => 'Report this seller reply',
    seller_reply_report_description: () => 'A moderator reviews every reply report.',
    seller_reply_report_reason_not_authentic: () => 'I doubt this came from the seller',
    seller_reply_report_details_label: () => 'What is wrong with the reply?',
    seller_reply_report_details_placeholder: () => 'Add details.',
    seller_reply_report_submit: () => 'Send reply report',
    review_report_reason_label: () => 'Reason',
    review_report_reason_offensive: () => 'Offensive or abusive',
    review_report_reason_spam: () => 'Spam or advertising',
    review_report_reason_personal_data: () => "Contains someone's personal details",
    review_report_reason_other: () => 'Something else',
    confirm_dialog_cancel: () => 'Cancel',
  }

  return {
    m: new Proxy(explicit, { get: (target, key: string) => target[key] ?? (() => key) }),
  }
})

function renderDialog(props: Partial<React.ComponentProps<typeof ReportSellerReplyDialog>> = {}) {
  const onSubmit = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ReportSellerReplyDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} {...props} />,
  )
  return { onSubmit, onOpenChange }
}

describe('ReportSellerReplyDialog', () => {
  it('uses reply-specific copy while preserving the existing report reason model', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: 'Report this seller reply' })).toBeDefined()
    const firstReason = screen.getAllByRole('radio')[0]
    expect(firstReason.getAttribute('value')).toBe('not_authentic')
    expect(screen.getByText('I doubt this came from the seller')).toBeDefined()
  })

  it('requires details for other and trims the submitted explanation', () => {
    const { onSubmit } = renderDialog()
    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }))
    const submit = screen.getByRole('button', { name: 'Send reply report' })
    expect(submit.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText(/What is wrong with the reply\?/), {
      target: { value: '  Contains a private address  ' },
    })
    fireEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledWith('other', 'Contains a private address')
  })

  it('announces report failures and blocks duplicate submissions while busy', () => {
    const { onSubmit } = renderDialog({
      busy: true,
      error: 'We could not send your report.',
    })
    expect(screen.getByRole('alert').textContent).toContain('We could not send your report.')
    fireEvent.click(screen.getByRole('button', { name: 'Send reply report' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('has no axe violations', async () => {
    renderDialog()
    expect(await axe(await screen.findByRole('dialog'))).toHaveNoViolations()
  })
})
