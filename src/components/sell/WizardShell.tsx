import { useBlocker, useNavigate, useRouter } from '@tanstack/react-router'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Save, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  normalizeOnboardingStage,
  SELL_ONBOARDING_STAGE_COUNT,
  SELL_ONBOARDING_STEPS,
} from '#/lib/sell-onboarding-steps'
import { m } from '#/paraglide/messages'
import { trackEvent } from '#/integrations/umami'
import { Button } from '../ui/button'
import { FeedbackBanner } from '../ui/FeedbackBanner'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '../ui/primitives/dialog'
import { useOnboarding } from './OnboardingProvider'

interface Props {
  draftId: string
  currentStep: number
  saveIndicator: 'saved' | 'saving' | 'unsaved' | 'error'
  children: React.ReactNode
}

function stepLabel(nameKey: (typeof SELL_ONBOARDING_STEPS)[number]['nameKey']): string {
  const labels = {
    profile: m.onboarding_stage_profile(),
    seller: m.onboarding_stage_seller(),
    product: m.onboarding_stage_product(),
    delivery: m.onboarding_stage_delivery(),
    review: m.onboarding_stage_review(),
  }
  return labels[nameKey]
}

export function WizardShell({ draftId, currentStep, saveIndicator, children }: Props) {
  const router = useRouter()
  const navigate = useNavigate()
  const { executeStepActions, isSaving, isDirty, saveError } = useOnboarding()
  const [isAdvancing, setIsAdvancing] = useState(false)
  const allowNextNavigation = useRef(false)

  const currentPath = router.state.location.pathname
  const activeStep = useMemo(
    () =>
      SELL_ONBOARDING_STEPS.find((step) => currentPath.includes(`/${step.path}`))?.id ??
      normalizeOnboardingStage(currentStep),
    [currentPath, currentStep],
  )
  const availableStep = normalizeOnboardingStage(currentStep)

  const blocker = useBlocker({
    shouldBlockFn: () => isDirty && !allowNextNavigation.current,
    enableBeforeUnload: isDirty,
    withResolver: true,
  })

  const navigateToStep = useCallback(
    async (stepPath: string) => {
      allowNextNavigation.current = true
      try {
        await navigate({ to: `/sell/onboarding/$draftId/${stepPath}`, params: { draftId } })
      } finally {
        allowNextNavigation.current = false
      }
    },
    [navigate, draftId],
  )

  const handleBack = useCallback(() => {
    if (activeStep <= 1) return
    const previous = SELL_ONBOARDING_STEPS[activeStep - 2]
    void navigateToStep(previous.path)
  }, [activeStep, navigateToStep])

  const handleContinue = useCallback(async () => {
    setIsAdvancing(true)
    try {
      const success = await executeStepActions(activeStep)
      if (!success || activeStep >= SELL_ONBOARDING_STAGE_COUNT) return
      void trackEvent('seller_onboarding_stage_completed', { stage: activeStep })
      await router.invalidate()
      const next = SELL_ONBOARDING_STEPS.find((step) => step.id === activeStep + 1)
      if (next) await navigateToStep(next.path)
    } catch {
      // The provider exposes a localized, actionable save error in the shell.
    } finally {
      setIsAdvancing(false)
    }
  }, [activeStep, executeStepActions, navigateToStep, router])

  const handleSaveAndExit = useCallback(async () => {
    setIsAdvancing(true)
    try {
      const success = await executeStepActions(activeStep)
      if (!success) return
      await router.invalidate()
      allowNextNavigation.current = true
      await navigate({ to: '/sell' })
    } catch {
      // Save errors remain visible and the creator stays on the current stage.
    } finally {
      allowNextNavigation.current = false
      setIsAdvancing(false)
    }
  }, [activeStep, executeStepActions, navigate, router])

  const indicatorText =
    saveIndicator === 'saving'
      ? m.onboarding_save_saving()
      : saveIndicator === 'unsaved'
        ? m.onboarding_save_unsaved()
        : saveIndicator === 'error'
          ? m.onboarding_save_failed()
          : m.onboarding_save_saved()
  const currentStage = SELL_ONBOARDING_STEPS[activeStep - 1]

  return (
    <div className='flex min-h-[100dvh] flex-col md:h-[100dvh] md:min-h-0 md:flex-row md:overflow-hidden'>
      <aside className='border-b border-border-default bg-surface-default md:h-full md:w-64 md:overflow-y-auto md:border-b-0 md:border-r'>
        <div className='p-4 md:p-6'>
          <div className='hidden md:block'>
            <p className='text-sm font-semibold text-accent-primary'>{m.app_name()}</p>
            <h2 className='mt-1 text-sm font-semibold uppercase tracking-wider text-text-muted'>
              {m.onboarding_shop_setup()}
            </h2>
          </div>

          <div className='flex items-center justify-between md:hidden' aria-live='polite'>
            <div>
              <p className='text-xs font-medium text-text-muted'>
                {m.onboarding_step_count({
                  current: String(activeStep),
                  total: String(SELL_ONBOARDING_STAGE_COUNT),
                })}
              </p>
              <p className='text-sm font-semibold text-text-primary'>
                {stepLabel(currentStage.nameKey)}
              </p>
            </div>
            <div className='flex gap-1' aria-hidden='true'>
              {SELL_ONBOARDING_STEPS.map((step) => (
                <span
                  key={step.id}
                  className={`h-1.5 w-8 rounded-full ${
                    step.id <= activeStep ? 'bg-accent-primary' : 'bg-surface-inset'
                  }`}
                />
              ))}
            </div>
          </div>

          <nav className='mt-6 hidden space-y-1 md:block' aria-label={m.onboarding_steps_label()}>
            {SELL_ONBOARDING_STEPS.map((step) => {
              const isActive = step.id === activeStep
              const isCompleted = step.id < availableStep
              const isClickable = step.id <= availableStep
              return (
                <button
                  key={step.id}
                  type='button'
                  onClick={() => isClickable && void navigateToStep(step.path)}
                  disabled={!isClickable}
                  aria-current={isActive ? 'step' : undefined}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 ${
                    isActive
                      ? 'bg-accent-primary/10 font-medium text-accent-primary'
                      : isCompleted
                        ? 'text-text-primary hover:bg-surface-inset'
                        : 'text-text-muted'
                  }`}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${
                      isActive
                        ? 'bg-accent-primary text-text-on-primary'
                        : isCompleted
                          ? 'bg-success text-text-on-primary'
                          : 'bg-surface-inset text-text-muted'
                    }`}
                  >
                    {isCompleted ? <Check size={14} aria-hidden='true' /> : step.id}
                  </span>
                  <span>{stepLabel(step.nameKey)}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </aside>

      <div className='flex flex-1 flex-col md:h-full md:overflow-hidden'>
        <header className='flex min-h-14 items-center justify-between border-b border-border-default px-4 py-2 md:px-8'>
          <div
            className={`flex items-center gap-2 text-sm ${
              saveIndicator === 'error' ? 'text-error' : 'text-text-muted'
            }`}
            role='status'
            aria-live='polite'
          >
            {saveIndicator === 'error' ? (
              <AlertTriangle size={16} aria-hidden='true' />
            ) : (
              <Save
                size={16}
                className={saveIndicator === 'saving' ? 'animate-pulse' : ''}
                aria-hidden='true'
              />
            )}
            <span>{indicatorText}</span>
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => void handleSaveAndExit()}
            disabled={isAdvancing || isSaving}
            className='min-h-11'
          >
            <X size={16} aria-hidden='true' />
            {m.onboarding_save_exit()}
          </Button>
        </header>

        <main className='page-transition-content flex-1 overflow-y-auto px-4 py-6 md:px-8'>
          <div className='mx-auto max-w-2xl'>
            {saveError && <FeedbackBanner type='error' message={saveError} />}
            {children}
          </div>
        </main>

        <footer className='border-t border-border-default bg-surface-default px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8'>
          <div className='mx-auto flex max-w-2xl items-center justify-between'>
            <Button
              variant='secondary'
              onClick={handleBack}
              disabled={activeStep <= 1 || isAdvancing}
              className='min-h-11'
            >
              <ChevronLeft size={16} aria-hidden='true' />
              {m.action_back()}
            </Button>

            {activeStep < SELL_ONBOARDING_STAGE_COUNT && (
              <Button
                variant='primary'
                onClick={() => void handleContinue()}
                disabled={isAdvancing || isSaving}
                isLoading={isAdvancing}
                className='min-h-11'
              >
                {m.action_continue()}
                <ChevronRight size={16} aria-hidden='true' />
              </Button>
            )}
          </div>
        </footer>
      </div>

      <Dialog open={blocker.status === 'blocked'}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className='mx-4 max-w-md'>
            <DialogTitle>{m.onboarding_leave_title()}</DialogTitle>
            <DialogDescription>{m.onboarding_leave_description()}</DialogDescription>
            <div className='mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
              <Button variant='secondary' onClick={blocker.reset}>
                {m.onboarding_keep_editing()}
              </Button>
              <Button variant='danger' onClick={blocker.proceed}>
                {m.onboarding_leave_without_saving()}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
