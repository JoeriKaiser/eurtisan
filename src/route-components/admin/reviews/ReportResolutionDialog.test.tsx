// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ReportResolutionDialog } from './ReportResolutionDialog'

vi.mock('#/paraglide/messages', () => {
  const explicit: Record<string, unknown> = {
    listing_report_admin_resolve_title_actioned: () => 'Record action on this report',
    listing_report_admin_resolve_title_dismissed: () => 'Dismiss this report',
    listing_report_admin_resolve_description: () => 'The decision and its note stay on record.',
    listing_report_admin_note_label: () => 'Resolution note',
    listing_report_admin_note_hint: () => 'What was checked and what was decided.',
    listing_report_admin_resolve_submit: () => 'Apply decision',
    confirm_dialog_cancel: () => 'Cancel',
  }

  return {
    m: new Proxy(explicit, { get: (target, key: string) => target[key] ?? (() => key) }),
  }
})

function renderDialog(
  props: Partial<React.ComponentProps<typeof ReportResolutionDialog>> = {},
  outcome: React.ComponentProps<typeof ReportResolutionDialog>['outcome'] = 'actioned',
) {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ReportResolutionDialog
      open
      outcome={outcome}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      {...props}
    />,
  )
  return { onConfirm, onOpenChange }
}

describe('ReportResolutionDialog', () => {
  it('restates the decision it is recording', () => {
    // The outcome is fixed by the queue button that opened the dialog; the
    // title must say which decision is about to become final.
    renderDialog({}, 'actioned')
    expect(screen.getByText('Record action on this report')).toBeDefined()
  })

  it('will not apply a decision without its note', () => {
    // A decision without grounds cannot be audited or later stated to the
    // people entitled to know.
    const { onConfirm } = renderDialog({}, 'dismissed')

    const submit = screen.getByRole('button', { name: 'Apply decision' })
    expect(submit.hasAttribute('disabled')).toBe(true)

    fireEvent.click(submit)
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/Resolution note/), {
      target: { value: 'Confirmed counterfeit; listing removed.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }))
    expect(onConfirm).toHaveBeenCalledWith('dismissed', 'Confirmed counterfeit; listing removed.')
  })

  it('sends the note trimmed', () => {
    const { onConfirm } = renderDialog()

    fireEvent.change(screen.getByLabelText(/Resolution note/), {
      target: { value: '  checked with the brand owner  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }))

    expect(onConfirm).toHaveBeenCalledWith('actioned', 'checked with the brand owner')
  })

  it('blocks submission while one is in flight', () => {
    const { onConfirm } = renderDialog({ busy: true })

    fireEvent.change(screen.getByLabelText(/Resolution note/), { target: { value: 'note' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('announces a failure rather than failing silently', () => {
    renderDialog({ error: 'We could not apply this decision.' })
    expect(screen.getByRole('alert').textContent).toContain('We could not apply this decision.')
  })

  it('has no axe violations', async () => {
    render(
      <ReportResolutionDialog
        open
        outcome='dismissed'
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const dialog = await screen.findByRole('dialog')
    expect(await axe(dialog)).toHaveNoViolations()
  })
})
