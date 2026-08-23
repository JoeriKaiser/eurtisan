// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ReportListingDialog } from './ReportListingDialog'

vi.mock('#/paraglide/messages', () => {
  const explicit: Record<string, unknown> = {
    listing_report_title_product: () => 'Report this product',
    listing_report_title_shop: () => 'Report this shop',
    listing_report_description_product: () => 'A moderator reviews every report.',
    listing_report_description_shop: () => 'A moderator reviews every report.',
    listing_report_reason_label: () => 'Reason',
    listing_report_reason_counterfeit: () => 'Counterfeit or fake goods',
    listing_report_reason_unsafe: () => 'Unsafe or hazardous',
    listing_report_reason_illegal_goods: () => 'Illegal or restricted goods',
    listing_report_reason_fraud: () => 'Fraud or scam',
    listing_report_reason_other: () => 'Something else',
    listing_report_details_label: () => 'What is wrong?',
    listing_report_details_placeholder: () => 'Add anything that helps.',
    listing_report_submit: () => 'Send report',
    confirm_dialog_cancel: () => 'Cancel',
  }

  return {
    m: new Proxy(explicit, { get: (target, key: string) => target[key] ?? (() => key) }),
  }
})

function renderDialog(
  props: Partial<React.ComponentProps<typeof ReportListingDialog>> = {},
  targetType: React.ComponentProps<typeof ReportListingDialog>['targetType'] = 'product',
) {
  const onSubmit = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ReportListingDialog
      open
      targetType={targetType}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return { onSubmit, onOpenChange }
}

describe('ReportListingDialog', () => {
  it('leads with the marketplace-integrity grounds and offers "other" last', () => {
    renderDialog()
    const radios = screen.getAllByRole('radio')
    expect(radios[0].getAttribute('value')).toBe('counterfeit')
    expect(radios[radios.length - 1]?.getAttribute('value')).toBe('other')
  })

  it('speaks about the product or the shop depending on the target', () => {
    renderDialog({}, 'product')
    expect(screen.getByText('Report this product')).toBeDefined()
  })

  it('sends the chosen ground with the notice', () => {
    const { onSubmit } = renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: 'Fraud or scam' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

    expect(onSubmit).toHaveBeenCalledWith('fraud', null)
  })

  it('speaks about the shop when the target is a shop', () => {
    const { unmount } = render(
      <ReportListingDialog open targetType='shop' onOpenChange={vi.fn()} onSubmit={vi.fn()} />,
    )
    expect(screen.getByText('Report this shop')).toBeDefined()
    unmount()
  })

  it('passes the explanation through trimmed', () => {
    const { onSubmit } = renderDialog()

    fireEvent.change(screen.getByLabelText('What is wrong?'), {
      target: { value: '  seller ships lookalikes  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))

    expect(onSubmit).toHaveBeenCalledWith('counterfeit', 'seller ships lookalikes')
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
    render(
      <ReportListingDialog open targetType='product' onOpenChange={vi.fn()} onSubmit={vi.fn()} />,
    )
    // Scans the dialog popup rather than the whole document, matching the
    // reference dialog test: the portal is flanked by library focus guards.
    const dialog = await screen.findByRole('dialog')
    expect(await axe(dialog)).toHaveNoViolations()
  })
})
