// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ForgotPassword } from './forgot-password'

const mockRequestPasswordReset = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useSearch: () => ({ redirect: undefined }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    forgot_password_title: () => 'Forgot password?',
    forgot_password_description: () => 'Enter your email and we will send a reset link.',
    field_email: () => 'Email',
    button_send_reset_link: () => 'Send reset link',
    error_unexpected: () => 'An unexpected error occurred',
    forgot_password_success: ({ email }: { email: string }) => `Check your inbox at ${email}`,
    button_resend_verification: () => 'Resend email',
    button_resend_cooldown: ({ seconds }: { seconds: string }) => `Resend in ${seconds}s`,
    button_back_to_home: () => 'Back to homepage',
    nav_logo: () => 'Eurtisan',
  },
}))

vi.mock('#/lib/auth-client', () => ({
  authClient: {
    requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  },
}))

describe('ForgotPassword', () => {
  beforeEach(() => {
    mockRequestPasswordReset.mockReset()
  })

  it('renders the forgot-password form', () => {
    render(<ForgotPassword />)

    expect(screen.getByRole('heading', { name: 'Forgot password?' })).toBeDefined()
    expect(screen.getByLabelText('Email')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeDefined()
  })

  it('renders the error banner above the submit button', async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: { message: 'User not found' } })

    render(<ForgotPassword />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'missing@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('User not found')
    })

    const form = screen.getByRole('button', { name: 'Send reset link' }).closest('form')
    const children = Array.from(form?.children ?? [])
    const bannerContainerIndex = children.findIndex((child) => child.className.includes('min-h-12'))
    const submitIndex = children.findIndex(
      (child) => child.tagName === 'BUTTON' && child.getAttribute('type') === 'submit',
    )
    expect(bannerContainerIndex).toBeGreaterThan(-1)
    expect(submitIndex).toBeGreaterThan(-1)
    expect(bannerContainerIndex).toBeLessThan(submitIndex)
  })

  it('shows a success message and disables the resend button initially', async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: null, data: {} })

    render(<ForgotPassword />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => {
      expect(screen.getByText('Check your inbox at user@example.com')).toBeDefined()
    })

    const resendButton = screen.getByRole('button', { name: 'Resend in 60s' })
    expect(resendButton).toBeDefined()
    expect(resendButton.hasAttribute('disabled')).toBe(true)
  })

  it('calls the auth client with the provided email and redirect path', async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: null, data: {} })

    render(<ForgotPassword />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith({
        email: 'user@example.com',
        redirectTo: '/reset-password',
      })
    })
  })
})
