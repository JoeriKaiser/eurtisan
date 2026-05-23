import { useNavigate, useRouter } from '@tanstack/react-router'
import { Check, ChevronLeft, ChevronRight, Save, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { useOnboarding } from './OnboardingProvider'

const STEPS = [
  { id: 1, name: 'Identity', path: 'identity' as const },
  { id: 2, name: 'Story', path: 'story' as const },
  { id: 3, name: 'Visuals', path: 'visuals' as const },
  { id: 4, name: 'Location', path: 'location' as const },
  { id: 5, name: 'Policies', path: 'policies' as const },
  { id: 6, name: 'Socials', path: 'socials' as const },
  { id: 7, name: 'First Listing', path: 'listing' as const },
  { id: 8, name: 'Review', path: 'review' as const },
]

interface Props {
  draftId: string
  currentStep: number
  saveIndicator: 'saved' | 'saving' | 'unsaved'
  children: React.ReactNode
}

export function WizardShell({ draftId, currentStep, saveIndicator, children }: Props) {
  const router = useRouter()
  const navigate = useNavigate()
  const { executeStepActions, isSaving } = useOnboarding()
  const [isAdvancing, setIsAdvancing] = useState(false)

  const currentPath = router.state.location.pathname
  const activeStep = useMemo(
    () => STEPS.find((s) => currentPath.includes(`/${s.path}`))?.id ?? currentStep,
    [currentPath, currentStep],
  )

  const canNavigateToStep = (stepId: number) => stepId <= currentStep

  const handleStepClick = useCallback(
    (stepPath: string) => {
      navigate({ to: `/sell/onboarding/$draftId/${stepPath}`, params: { draftId } })
    },
    [navigate, draftId],
  )

  const handleBack = useCallback(() => {
    if (activeStep <= 1) return
    const prev = STEPS[activeStep - 2]
    navigate({ to: `/sell/onboarding/$draftId/${prev.path}`, params: { draftId } })
  }, [activeStep, navigate, draftId])

  const handleContinue = useCallback(async () => {
    setIsAdvancing(true)
    try {
      const success = await executeStepActions(activeStep)
      if (success && activeStep < 8) {
        const next = STEPS[activeStep]
        navigate({ to: `/sell/onboarding/$draftId/${next.path}`, params: { draftId } })
      }
    } finally {
      setIsAdvancing(false)
    }
  }, [activeStep, executeStepActions, navigate, draftId])

  const handleSaveAndExit = useCallback(async () => {
    await executeStepActions(activeStep)
    navigate({ to: '/sell' })
  }, [executeStepActions, activeStep, navigate])

  const indicatorText =
    saveIndicator === 'saving'
      ? 'Saving…'
      : saveIndicator === 'unsaved'
        ? 'Unsaved changes'
        : 'Saved'

  return (
    <div className='flex h-auto min-h-[calc(100vh-65px)] flex-col md:h-[calc(100vh-65px)] md:min-h-0 md:flex-row md:overflow-hidden'>
      {/* Sidebar / Mobile Stepper */}
      <aside className='border-b border-border-default bg-surface-default md:w-64 md:border-b-0 md:border-r md:h-full md:overflow-y-auto'>
        <div className='p-4 md:p-6'>
          <h2 className='mb-4 hidden text-sm font-semibold uppercase tracking-wider text-text-muted md:block'>
            Shop Setup
          </h2>

          {/* Mobile: horizontal step dots */}
          <div className='flex items-center gap-2 overflow-x-auto md:hidden'>
            {STEPS.map((step) => (
              <button
                key={step.id}
                type='button'
                onClick={() => canNavigateToStep(step.id) && handleStepClick(step.path)}
                disabled={!canNavigateToStep(step.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  step.id === activeStep
                    ? 'bg-accent-primary text-text-on-primary'
                    : step.id < currentStep
                      ? 'text-accent-primary'
                      : 'text-text-muted'
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-xs ${
                    step.id <= currentStep
                      ? 'bg-accent-primary text-text-on-primary'
                      : 'bg-surface-inset text-text-muted'
                  }`}
                >
                  {step.id < currentStep ? <Check size={12} /> : step.id}
                </span>
                <span className='whitespace-nowrap'>{step.name}</span>
              </button>
            ))}
          </div>

          {/* Desktop: vertical step list */}
          <nav className='hidden space-y-1 md:block' aria-label='Onboarding steps'>
            {STEPS.map((step) => {
              const isActive = step.id === activeStep
              const isCompleted = step.id < currentStep
              const isClickable = canNavigateToStep(step.id)

              return (
                <button
                  key={step.id}
                  type='button'
                  onClick={() => isClickable && handleStepClick(step.path)}
                  disabled={!isClickable}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? 'bg-accent-primary/10 font-medium text-accent-primary'
                      : isCompleted
                        ? 'text-text-primary hover:bg-surface-inset'
                        : 'text-text-muted'
                  }`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      isActive
                        ? 'bg-accent-primary text-text-on-primary'
                        : isCompleted
                          ? 'bg-success text-text-on-primary'
                          : 'bg-surface-inset text-text-muted'
                    }`}
                  >
                    {isCompleted ? <Check size={14} /> : step.id}
                  </span>
                  <span>{step.name}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className='flex flex-1 flex-col md:h-full md:overflow-hidden'>
        {/* Top Bar */}
        <header className='flex items-center justify-between border-b border-border-default px-4 py-3 md:px-8'>
          <div className='flex items-center gap-2 text-sm text-text-muted'>
            <Save size={14} className={saveIndicator === 'saving' ? 'animate-pulse' : ''} />
            <span>{indicatorText}</span>
          </div>
          <Button variant='ghost' size='sm' onClick={handleSaveAndExit}>
            <X size={14} />
            Save & Exit
          </Button>
        </header>

        {/* Step Content */}
        <main className='flex-1 overflow-y-auto px-4 py-6 md:px-8'>
          <div className='mx-auto max-w-2xl'>{children}</div>
        </main>

        {/* Bottom Bar */}
        <footer className='border-t border-border-default px-4 py-4 md:px-8'>
          <div className='mx-auto flex max-w-2xl items-center justify-between'>
            <Button
              variant='secondary'
              onClick={handleBack}
              disabled={activeStep <= 1 || isAdvancing}
            >
              <ChevronLeft size={16} />
              Back
            </Button>

            {activeStep === 8 ? (
              <Button
                variant='primary'
                onClick={handleContinue}
                disabled={isAdvancing || isSaving}
                isLoading={isAdvancing}
              >
                Open My Shop
              </Button>
            ) : (
              <Button
                variant='primary'
                onClick={handleContinue}
                disabled={isAdvancing || isSaving}
                isLoading={isAdvancing}
              >
                Continue
                <ChevronRight size={16} />
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
