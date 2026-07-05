// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignIn } from './signin'

const mockNavigate = vi.fn()
const mockInvalidate = vi.fn()

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
  useRouter: () => ({
    navigate: mockNavigate,
    invalidate: mockInvalidate,
  }),
  useSearch: () => ({ redirect: undefined }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    sign_up_title: () => 'Create an account',
    sign_up_description: () => 'Start selling your handmade goods',
    sign_in_title: () => 'Sign in',
    sign_in_description: () => 'Welcome back',
    field_name: () => 'Name',
    field_email: () => 'Email',
    field_password: () => 'Password',
    field_confirm_password: () => 'Confirm password',
    forgot_password_title: () => 'Forgot password?',
    button_create_account: () => 'Create account',
    button_sign_in: () => 'Sign in',
    error_unexpected: () => 'An unexpected error occurred',
    password_rule_length: () => 'Password must be at least 8 characters',
    error_passwords_do_not_match: () => 'Passwords do not match',
    error_sign_up_failed: () => 'Sign up failed',
    error_sign_in_failed: () => 'Sign in failed',
    error_sign_in_account_deleted: () =>
      'This account has been deactivated. Contact support@eurtisan.eu to recover your account.',
    two_factor_title: () => 'Two-factor authentication',
    two_factor_description: () => 'Enter the 6-digit code from your authenticator app.',
    two_factor_code_label: () => 'Authenticator code',
    two_factor_code_format_hint: () => 'Enter the 6-digit code from your authenticator app.',
    two_factor_button_verify: () => 'Verify and sign in',
    two_factor_back_to_sign_in: () => 'Back to sign in',
    two_factor_info: () => 'Enter the 6-digit code from your authenticator app.',
    button_hide_password: () => 'Hide password',
    button_show_password: () => 'Show password',
    link_switch_to_sign_in: () => 'Already have an account? Sign in',
    link_switch_to_sign_up: () => 'Need an account? Sign up',
    oauth_or_separator: () => 'Or continue with',
    oauth_provider_google: () => 'Google',
    oauth_provider_github: () => 'GitHub',
    oauth_provider_apple: () => 'Apple',
    oauth_social_toast: () => 'Social login is currently disabled.',
    button_back_to_home: () => 'Back to homepage',
    nav_logo: () => 'Eurtisan',
  },
}))

vi.mock('#/components/auth/PasswordStrengthIndicator', () => ({
  PasswordStrengthIndicator: () => <div data-testid='password-strength' />,
}))

vi.mock('#/components/AnalyticsConsentBanner', () => ({
  AnalyticsConsentBanner: () => null,
}))

const mockSignInEmail = vi.fn()
const mockSignUpEmail = vi.fn()
const mockVerifyTotp = vi.fn()

vi.mock('#/lib/auth-client', () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => mockSignInEmail(...args) },
    signUp: { email: (...args: unknown[]) => mockSignUpEmail(...args) },
    twoFactor: { verifyTotp: (...args: unknown[]) => mockVerifyTotp(...args) },
  },
}))

describe('SignIn', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockInvalidate.mockClear()
    mockSignInEmail.mockReset()
    mockSignUpEmail.mockReset()
    mockVerifyTotp.mockReset()
  })

  it('renders the sign-in form by default', () => {
    render(<SignIn />)

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(screen.getByLabelText('Email')).toBeDefined()
    expect(screen.getByLabelText('Password')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined()
  })

  it('renders the sign-up form when toggled', () => {
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }))

    expect(screen.getByRole('heading', { name: 'Create an account' })).toBeDefined()
    expect(screen.getByLabelText('Name')).toBeDefined()
    expect(screen.getByLabelText('Confirm password')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDefined()
  })

  it('shows client-side validation errors without calling the auth client', async () => {
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Password must be at least 8 characters',
      )
    })
    expect(mockSignUpEmail).not.toHaveBeenCalled()
  })

  it('renders the error banner above the submit button with reserved space to avoid layout shift', async () => {
    mockSignInEmail.mockResolvedValue({ error: { message: 'Invalid credentials' }, data: null })

    render(<SignIn />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Invalid credentials')
    })

    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form')
    const children = Array.from(form?.children ?? [])
    const bannerContainerIndex = children.findIndex((child) =>
      child.className.includes('min-h-[3.5rem]'),
    )
    const submitIndex = children.findIndex(
      (child) => child.tagName === 'BUTTON' && child.getAttribute('type') === 'submit',
    )
    expect(bannerContainerIndex).toBeGreaterThan(-1)
    expect(submitIndex).toBeGreaterThan(-1)
    expect(bannerContainerIndex).toBeLessThan(submitIndex)
  })

  it('shows a helpful message when signing in to a deactivated account', async () => {
    mockSignInEmail.mockResolvedValue({
      error: { code: 'ACCOUNT_DELETED', message: 'This account has been deactivated.' },
      data: null,
    })

    render(<SignIn />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('This account has been deactivated')
    })
  })

  it('navigates home after a successful sign-in', async () => {
    mockSignInEmail.mockResolvedValue({ error: null, data: {} })

    render(<SignIn />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    })
  })

  it('switches to the two-factor form when required and renders the info banner above verify button', async () => {
    mockSignInEmail.mockResolvedValue({ error: null, data: { twoFactorRedirect: true } })

    render(<SignIn />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Authenticator code')).toBeDefined()
    })

    expect(screen.getByRole('heading', { name: 'Two-factor authentication' })).toBeDefined()
    expect(screen.getByRole('status').textContent).toContain(
      'Enter the 6-digit code from your authenticator app.',
    )

    const form = screen.getByRole('button', { name: 'Verify and sign in' }).closest('form')
    const children = Array.from(form?.children ?? [])
    const bannerContainerIndex = children.findIndex((child) => child.className.includes('min-h-12'))
    const submitIndex = children.findIndex(
      (child) => child.tagName === 'BUTTON' && child.getAttribute('type') === 'submit',
    )
    expect(bannerContainerIndex).toBeGreaterThan(-1)
    expect(submitIndex).toBeGreaterThan(-1)
    expect(bannerContainerIndex).toBeLessThan(submitIndex)
  })

  it('renders social login buttons with visible provider text and no aria-label', () => {
    render(<SignIn />)

    const google = screen.getByRole('button', { name: 'Google' })
    const github = screen.getByRole('button', { name: 'GitHub' })
    const apple = screen.getByRole('button', { name: 'Apple' })

    expect(google).toBeDefined()
    expect(github).toBeDefined()
    expect(apple).toBeDefined()

    expect(google.getAttribute('aria-label')).toBeNull()
    expect(github.getAttribute('aria-label')).toBeNull()
    expect(apple.getAttribute('aria-label')).toBeNull()
  })

  it('shows a social-login info toast when a provider button is clicked', () => {
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: 'Google' }))

    expect(screen.getByRole('status').textContent).toContain('Social login is currently disabled.')
  })

  it('adds focus-visible ring classes to the forgot-password link', () => {
    render(<SignIn />)

    const link = screen.getByRole('link', { name: 'Forgot password?' })
    expect(link.className).toContain('focus-visible:ring-2')
    expect(link.className).toContain('focus-visible:ring-accent-secondary')
    expect(link.className).toContain('rounded')
    expect(link.className).toContain('hover:text-accent-primary-hover')
  })

  it('adds focus-visible ring classes to the back-to-sign-in button', () => {
    mockSignInEmail.mockResolvedValue({ error: null, data: { twoFactorRedirect: true } })

    render(<SignIn />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    return waitFor(() => {
      const button = screen.getByRole('button', { name: 'Back to sign in' })
      expect(button.className).toContain('focus-visible:ring-2')
      expect(button.className).toContain('focus-visible:ring-accent-secondary')
    })
  })

  it('submits the two-factor code and navigates on success', async () => {
    mockSignInEmail.mockResolvedValue({ error: null, data: { twoFactorRedirect: true } })
    mockVerifyTotp.mockResolvedValue({ error: null, data: {} })

    render(<SignIn />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Authenticator code')).toBeDefined()
    })

    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }))

    await waitFor(() => {
      expect(mockVerifyTotp).toHaveBeenCalledWith({ code: '123456' })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    })
  })

  it('enforces numeric 6-digit constraints on the two-factor code input', async () => {
    mockSignInEmail.mockResolvedValue({ error: null, data: { twoFactorRedirect: true } })

    render(<SignIn />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      const input = screen.getByLabelText('Authenticator code') as HTMLInputElement
      expect(input.getAttribute('inputMode')).toBe('numeric')
      expect(input.getAttribute('autoComplete')).toBe('one-time-code')
      expect(input.getAttribute('minLength')).toBe('6')
      expect(input.getAttribute('maxLength')).toBe('6')
      expect(input.getAttribute('pattern')).toBe('[0-9]{6}')
    })
  })

  it('shows the mismatched-password error on sign-up without calling the auth client', async () => {
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: 'Need an account? Sign up' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test User' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'different123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Passwords do not match')
    })
    expect(mockSignUpEmail).not.toHaveBeenCalled()
  })
})
