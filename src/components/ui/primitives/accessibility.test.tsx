// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './dialog'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from './dropdown-menu'

function TestDialog() {
  return (
    <Dialog>
      <DialogTrigger>Delete listing</DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup>
          <DialogTitle>Delete listing?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
          <label htmlFor='confirmation'>Type DELETE</label>
          <input id='confirmation' />
          <DialogClose>Cancel</DialogClose>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}

function TestMenu({ onChoose = vi.fn() }: { onChoose?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open actions</DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPopup>
          <DropdownMenuItem onClick={onChoose}>Edit product</DropdownMenuItem>
          <DropdownMenuItem>Archive product</DropdownMenuItem>
        </DropdownMenuPopup>
      </DropdownMenuPortal>
    </DropdownMenu>
  )
}

describe('accessible interaction primitives', () => {
  it('names the dialog, traps focus, closes with Escape, and restores trigger focus', async () => {
    render(<TestDialog />)
    const trigger = screen.getByRole('button', { name: 'Delete listing' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: 'Delete listing?' })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(await axe(dialog)).toHaveNoViolations()

    fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('operates menus by keyboard and restores focus when dismissed', async () => {
    render(<TestMenu />)
    const trigger = screen.getByRole('button', { name: 'Open actions' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    const menu = await screen.findByRole('menu')
    await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('menuitem'))
    expect(await axe(menu)).toHaveNoViolations()

    fireEvent.keyDown(document.activeElement ?? menu, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })
})
