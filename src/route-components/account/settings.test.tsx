// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSettings } from './settings'

const mockUpdateInApp = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => ({
    preferences: [
      {
        category: 'seller_updates',
        enabled: true,
        labelKey: 'account_email_preference_seller_updates',
        descriptionKey: 'account_email_preference_seller_updates_description',
      },
    ],
    inAppPreferences: [
      {
        type: 'low_stock',
        enabled: true,
        labelKey: 'account_in_app_preference_low_stock',
        descriptionKey: 'account_in_app_preference_low_stock_description',
      },
      {
        type: 'review_received',
        enabled: true,
        labelKey: 'account_in_app_preference_review_received',
        descriptionKey: 'account_in_app_preference_review_received_description',
      },
      {
        type: 'seller_reply_received',
        enabled: true,
        labelKey: 'account_in_app_preference_seller_reply_received',
        descriptionKey: 'account_in_app_preference_seller_reply_received_description',
      },
    ],
    user: { role: 'creator' },
  }),
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('#/lib/account-data', () => ({
  exportMyData: vi.fn(),
  deleteMyAccount: vi.fn(),
}))

vi.mock('#/lib/account-email-preferences', () => ({
  updateMyEmailPreference: vi.fn(),
}))

vi.mock('#/lib/notifications/preferences', () => ({
  updateMyInAppNotificationPreference: mockUpdateInApp,
  getMyInAppNotificationPreferences: vi.fn(),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    account_settings: () => 'Settings',
    account_security_title: () => 'Security',
    account_export_data: () => 'Download my data',
    account_export_description: () => 'Export your profile data.',
    account_email_preferences_title: () => 'Email notifications',
    account_email_preferences_description: () => 'Choose email notifications.',
    account_email_preference_seller_updates: () => 'Seller updates',
    account_email_preference_seller_updates_description: () => 'Seller update alerts.',
    account_email_preference_saved: () => 'Saved',
    account_email_preference_error: () => 'Could not save preference.',
    account_in_app_preferences_title: () => 'In-app notifications',
    account_in_app_preferences_description: () => 'Choose in-app notifications.',
    account_in_app_preferences_mandatory_note: () =>
      'Order status, dispute, payout, security, and moderation notices are mandatory.',
    account_in_app_preference_low_stock: () => 'Low-stock alerts',
    account_in_app_preference_low_stock_description: () => 'Alerts for low product stock.',
    account_in_app_preference_review_received: () => 'New review alerts',
    account_in_app_preference_review_received_description: () => 'Alerts for new reviews.',
    account_in_app_preference_seller_reply_received: () => 'Seller reply alerts',
    account_in_app_preference_seller_reply_received_description: () => 'Alerts for seller replies.',
    account_in_app_preference_saved: () => 'Saved',
    account_in_app_preference_error: () => 'Could not save preference. Please try again.',
    account_delete_account: () => 'Delete account',
    account_delete_description: () => 'Permanently delete account.',
    account_delete_confirm_label: () => 'Type email',
    account_delete_confirm_placeholder: () => 'your@email.com',
    account_delete_submit: () => 'Delete account',
  },
}))

describe('AccountSettings in-app preferences', () => {
  beforeEach(() => {
    mockUpdateInApp.mockReset()
  })

  it('renders in-app preferences section and mandatory notification explanation', () => {
    render(<AccountSettings />)

    expect(screen.getByText('In-app notifications')).toBeDefined()
    expect(
      screen.getByText(
        'Order status, dispute, payout, security, and moderation notices are mandatory.',
      ),
    ).toBeDefined()
    expect(screen.getByLabelText('Low-stock alerts')).toBeDefined()
    expect(screen.getByLabelText('New review alerts')).toBeDefined()
    expect(screen.getByLabelText('Seller reply alerts')).toBeDefined()
  })

  it('toggles preference switch and calls updateInAppNotificationPreference', async () => {
    mockUpdateInApp.mockResolvedValueOnce({ success: true })

    render(<AccountSettings />)

    const switchBtn = screen.getByLabelText('Low-stock alerts')
    expect(switchBtn.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(switchBtn)

    expect(mockUpdateInApp).toHaveBeenCalledWith({
      data: { type: 'low_stock', enabled: false },
    })

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeDefined()
    })
  })

  it('rolls back preference state when API call fails', async () => {
    mockUpdateInApp.mockRejectedValueOnce(new Error('Network error'))

    render(<AccountSettings />)

    const switchBtn = screen.getByLabelText('New review alerts')
    expect(switchBtn.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(switchBtn)

    await waitFor(() => {
      expect(screen.getByText('Could not save preference. Please try again.')).toBeDefined()
    })

    expect(switchBtn.getAttribute('aria-checked')).toBe('true')
  })
})
