// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ReportShopDialog } from './ReportShopDialog'

vi.mock('#/paraglide/messages', () => {
  const explicit: Record<string, unknown> = {
    shop_report_title: () => 'Report this shop (DSA Notice)',
    shop_report_description: () => 'Notify us of illegal content under DSA Article 16.',
    shop_report_reason_label: () => 'Ground for notice',
    product_report_reason_illegal: () => 'Illegal or prohibited item',
    product_report_reason_ip: () => 'Intellectual property infringement',
    product_report_reason_fraud: () => 'Counterfeit, fraudulent, or deceptive listing',
    product_report_reason_offensive: () => 'Offensive, hateful, or abusive content',
    product_report_reason_other: () => 'Other legal violation',
    shop_report_details_label: () => 'Explanation and substantiation',
    shop_report_details_placeholder: () => 'Provide explanation...',
    shop_report_submit: () => 'Submit Notice',
    confirm_dialog_cancel: () => 'Cancel',
  }

  return {
    m: new Proxy(explicit, { get: (target, key: string) => target[key] ?? (() => key) }),
  }
})

function renderDialog(props: Partial<React.ComponentProps<typeof ReportShopDialog>> = {}) {
  const onSubmit = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ReportShopDialog
      open
      onOpenChange={onOpenChange}
      shopName='Nordic Pottery Studio'
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return { onSubmit, onOpenChange }
}

describe('ReportShopDialog', () => {
  it('offers the illegal item ground first', () => {
    renderDialog()
    const radios = screen.getAllByRole('radio')
    expect(radios[0].getAttribute('value')).toBe('illegal')
  })

  it('submits selected reason and details', () => {
    const { onSubmit } = renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: 'Intellectual property infringement' }))
    fireEvent.change(screen.getByLabelText('Explanation and substantiation'), {
      target: { value: 'Trademark infringement details' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Notice' }))

    expect(onSubmit).toHaveBeenCalledWith('ip', 'Trademark infringement details')
  })

  it('requires explanation when reason is other', () => {
    const { onSubmit } = renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: 'Other legal violation' }))
    const submitBtn = screen.getByRole('button', { name: 'Submit Notice' })
    expect(submitBtn.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText(/Explanation and substantiation/), {
      target: { value: 'Specific legal grounds' },
    })
    expect(submitBtn.hasAttribute('disabled')).toBe(false)

    fireEvent.click(submitBtn)
    expect(onSubmit).toHaveBeenCalledWith('other', 'Specific legal grounds')
  })

  it('has no axe violations', async () => {
    render(
      <ReportShopDialog
        open
        onOpenChange={vi.fn()}
        shopName='Nordic Pottery Studio'
        onSubmit={vi.fn()}
      />,
    )
    const dialog = await screen.findByRole('dialog')
    expect(await axe(dialog)).toHaveNoViolations()
  })
})
