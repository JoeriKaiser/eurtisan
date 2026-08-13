// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResetPassword } from './reset-password'

const mockNavigate = vi.fn()
const mockResetPassword = vi.fn()
let mockSearch = {
  token: 'valid-token' as string | undefined,
  redirect: undefined as string | undefined,
}

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    className?: string
    search?: Record<string, unknown>
    [key: string]: unknown
  }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useSearch: () => mockSearch,
  useRouter: () => ({ navigate: mockNavigate }),
}))

vi.mock('#/components/AnalyticsConsentBanner', () => ({
  AnalyticsConsentBanner: () => null,
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    reset_password_title: () => 'Reset password',
    reset_password_description: () => 'Enter a new password below.',
    field_new_password: () => 'New password',
    field_confirm_password: () => 'Confirm password',
    button_reset_password: () => 'Reset password',
    button_sign_in: () => 'Sign in',
    error_unexpected: () => 'An unexpected error occurred',
    password_rule_length: () => 'Password must be at least 8 characters',
    error_passwords_do_not_match: () => 'Passwords do not match',
    error_reset_token_invalid: () => 'Invalid or expired reset token',
    forgot_password_description: () => 'Enter your email to receive a reset link.',
    forgot_password_title: () => 'Forgot password?',
    reset_password_success: () => 'Your password has been reset.',
    button_hide_password: () => 'Hide password',
    button_show_password: () => 'Show password',
    button_back_to_home: () => 'Back to homepage',
    button_request_new_reset_link: () => 'Request new link',
    nav_logo: () => 'Eurtisan',
  },
}))

vi.mock('#/components/auth/PasswordStrengthIndicator', () => ({
  PasswordStrengthIndicator: () => <div data-testid='password-strength' />,
}))

vi.mock('#/lib/auth-client', () => ({
  authClient: {
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  },
}))

describe('ResetPassword', () => {
  beforeEach(() => {
    mockResetPassword.mockReset()
    mockNavigate.mockReset()
    mockSearch = { token: 'valid-token', redirect: undefined }
  })

  it('renders the missing-token error with a request-new-link CTA', () => {
    mockSearch = { token: undefined, redirect: undefined }

    render(<ResetPassword />)

    expect(screen.getByRole('alert').textContent).toContain('Invalid or expired reset token')
    expect(screen.getByRole('link', { name: 'Request new link' })).toBeDefined()
  })

  it('renders the reset-password form when a token is present', () => {
    render(<ResetPassword />)

    expect(screen.getByRole('heading', { name: 'Reset password' })).toBeDefined()
    expect(screen.getByLabelText('New password')).toBeDefined()
    expect(screen.getByLabelText('Confirm password')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDefined()
  })

  it('renders the error banner above the submit button', async () => {
    mockResetPassword.mockResolvedValue({ error: { message: 'Token expired' } })

    render(<ResetPassword />)

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Token expired')
    })

    const form = screen.getByRole('button', { name: 'Reset password' }).closest('form')
    const children = Array.from(form?.children ?? [])
    const bannerContainerIndex = children.findIndex((child) => child.className.includes('min-h-12'))
    const submitIndex = children.findIndex(
      (child) => child.tagName === 'BUTTON' && child.getAttribute('type') === 'submit',
    )
    expect(bannerContainerIndex).toBeGreaterThan(-1)
    expect(submitIndex).toBeGreaterThan(-1)
    expect(bannerContainerIndex).toBeLessThan(submitIndex)
  })

  it('shows a validation error when the password is too short', async () => {
    render(<ResetPassword />)

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Password must be at least 8 characters',
      )
    })
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('shows a validation error when passwords do not match', async () => {
    render(<ResetPassword />)

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Passwords do not match')
    })
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('calls the auth client and shows the success state', async () => {
    mockResetPassword.mockResolvedValue({ error: null, data: {} })

    render(<ResetPassword />)

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        newPassword: 'password123',
        token: 'valid-token',
      })
      expect(screen.getByText('Your password has been reset.')).toBeDefined()
    })
  })
})
