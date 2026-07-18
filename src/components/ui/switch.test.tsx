// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Switch } from './switch'

it('exposes native switch state, an accessible name, and a 44px target', () => {
  const onCheckedChange = vi.fn()
  render(
    <Switch
      checked={false}
      onCheckedChange={onCheckedChange}
      aria-label='Offer international delivery'
    />,
  )

  const control = screen.getByRole('switch', { name: 'Offer international delivery' })
  expect(control.getAttribute('aria-checked')).toBe('false')
  expect(control.classList.contains('size-11')).toBe(true)
  fireEvent.click(control)
  expect(onCheckedChange).toHaveBeenCalledWith(true)
})
