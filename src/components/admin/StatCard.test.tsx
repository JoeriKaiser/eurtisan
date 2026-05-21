// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(
      <StatCard
        icon={<span data-testid='icon'>icon</span>}
        label='Total Users'
        value={42}
        iconBgClass='bg-accent-primary-subtle'
        iconColorClass='text-accent-primary'
      />,
    )

    expect(screen.getByText('Total Users')).toBeDefined()
    expect(screen.getByText('42')).toBeDefined()
  })

  it('renders string value', () => {
    render(
      <StatCard
        icon={<span>icon</span>}
        label='Revenue'
        value='€1.234,56'
        iconBgClass='bg-success-subtle'
        iconColorClass='text-success'
      />,
    )

    expect(screen.getByText('€1.234,56')).toBeDefined()
  })

  it('renders as link when href is provided', () => {
    render(
      <StatCard
        icon={<span>icon</span>}
        label='Orders'
        value={5}
        iconBgClass='bg-warning-subtle'
        iconColorClass='text-warning'
        href='/admin/orders'
      />,
    )

    expect(screen.getByRole('link')).toBeDefined()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(
      <StatCard
        icon={<span>icon</span>}
        label='Shops'
        value={3}
        iconBgClass='bg-accent-secondary-subtle'
        iconColorClass='text-accent-secondary'
        onClick={handleClick}
      />,
    )

    const button = screen.getByRole('button')
    button.click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
