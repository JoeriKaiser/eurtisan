// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShopDraft } from '#/lib/sell-onboarding'
import { OnboardingProvider, useOnboarding } from './OnboardingProvider'
import { WizardShell } from './WizardShell'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(async () => undefined),
  invalidate: vi.fn(async () => undefined),
  trackEvent: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useRouter: () => ({
    state: { location: { pathname: '/sell/onboarding/draft-1/identity' } },
    invalidate: mocks.invalidate,
  }),
  useBlocker: () => ({ status: 'idle', proceed: vi.fn(), reset: vi.fn() }),
}))

vi.mock('#/integrations/umami', () => ({ trackEvent: mocks.trackEvent }))
vi.mock('#/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_target, key) => (values?: Record<string, string>) => {
        if (key === 'onboarding_step_count') return `Step ${values?.current} of ${values?.total}`
        if (key === 'onboarding_save_exit') return 'Save draft & exit'
        if (key === 'onboarding_save_failed') return 'Draft not saved'
        if (key === 'onboarding_error_save_failed') return 'Save failed safely'
        if (key === 'action_continue') return 'Continue'
        if (key === 'action_back') return 'Back'
        return String(key)
      },
    },
  ),
}))

const draft = {
  id: 'draft-1',
  ownerId: 'seller-1',
  name: '',
  slug: 'draft-1',
  status: 'draft',
  onboardingStep: 1,
  resubmissionCount: 0,
  paymentConnected: false,
  socials: [],
} as unknown as ShopDraft

function SaveStateHarness() {
  const { isDirty, saveError, updateField, runSave } = useOnboarding()
  return (
    <div>
      <output>{isDirty ? 'dirty' : 'clean'}</output>
      {saveError && <p>{saveError}</p>}
      <button type='button' onClick={() => updateField(1, 'name', 'Changed shop')}>
        Edit
      </button>
      <button
        type='button'
        onClick={() => {
          void runSave(async () => {
            throw new Error('offline')
          }).catch(() => undefined)
        }}
      >
        Fail save
      </button>
      <button type='button' onClick={() => void runSave(async () => undefined)}>
        Save
      </button>
    </div>
  )
}

function StepActionHarness() {
  const { registerStepActions, runSave } = useOnboarding()
  return (
    <div>
      <button
        type='button'
        onClick={() =>
          registerStepActions(1, { validate: () => false, save: async () => undefined })
        }
      >
        Register invalid
      </button>
      <button
        type='button'
        onClick={() =>
          registerStepActions(1, {
            validate: () => true,
            save: () =>
              runSave(async () => {
                throw new Error('offline')
              }),
          })
        }
      >
        Register failing
      </button>
      <button
        type='button'
        onClick={() =>
          registerStepActions(1, {
            validate: () => true,
            save: () => runSave(async () => undefined),
          })
        }
      >
        Register valid
      </button>
    </div>
  )
}

describe('seller onboarding persistence UI', () => {
  beforeEach(() => {
    mocks.navigate.mockClear()
    mocks.invalidate.mockClear()
    mocks.trackEvent.mockClear()
  })

  it('tracks dirty state and keeps edits dirty after a recoverable save failure', async () => {
    const states: string[] = []
    render(
      <OnboardingProvider
        draft={draft}
        listing={null}
        onSaveStateChange={(state) => states.push(state)}
      >
        <SaveStateHarness />
      </OnboardingProvider>,
    )

    expect(screen.getByText('clean')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('dirty')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Fail save' }))
    expect(await screen.findByText('Save failed safely')).not.toBeNull()
    expect(screen.getByText('dirty')).not.toBeNull()
    expect(states).toContain('error')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('clean')).not.toBeNull())
    expect(states.at(-1)).toBe('saved')
  })

  it('blocks invalid or failed exits and exposes the compact five-stage mobile summary', async () => {
    render(
      <OnboardingProvider draft={draft} listing={null}>
        <WizardShell draftId={draft.id} currentStep={1} saveIndicator='unsaved'>
          <StepActionHarness />
        </WizardShell>
      </OnboardingProvider>,
    )

    expect(screen.getByText('Step 1 of 5')).not.toBeNull()
    expect(screen.getByRole('navigation', { name: 'onboarding_steps_label' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Register invalid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save draft & exit' }))
    await waitFor(() => expect(mocks.navigate).not.toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Register failing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save draft & exit' }))
    expect(await screen.findByText('Save failed safely')).not.toBeNull()
    expect(mocks.navigate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Register valid' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save draft & exit' }))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/sell' }))
  })
})
