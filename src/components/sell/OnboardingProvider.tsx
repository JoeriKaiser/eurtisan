import type React from 'react'
import { createContext, useContext, useCallback, useMemo, useRef, useState } from 'react'
import type { ShopDraft } from '#/lib/sell-onboarding'
import { saveOnboardingStep } from '#/lib/sell-onboarding'

interface StepActions {
  validate: () => boolean
  save: () => Promise<void>
}

interface OnboardingContextType {
  draft: ShopDraft
  updateField: (step: number, field: string, value: unknown) => void
  updateFields: (step: number, fields: Record<string, unknown>) => void
  saveStep: (step: number, fields?: Record<string, unknown>) => Promise<void>
  isSaving: boolean
  lastSaved: Date | null
  getStepData: (step: number) => Record<string, unknown>
  registerStepActions: (step: number, actions: StepActions | null) => void
  executeStepActions: (step: number) => Promise<boolean>
}

const OnboardingContext = createContext<OnboardingContextType | null>(null)

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider')
  return ctx
}

interface Props {
  draft: ShopDraft
  onSaveStateChange?: (state: 'saved' | 'saving' | 'unsaved') => void
  children: React.ReactNode
}

export function OnboardingProvider({ draft, onSaveStateChange, children }: Props) {
  const [stepData, setStepData] = useState<Record<number, Record<string, unknown>>>(() => {
    // Hydrate step data from draft
    return {
      1: {
        name: draft.name,
        slug: draft.slug,
        tagline: draft.tagline ?? '',
        category: draft.category ?? '',
        productionType: draft.productionType ?? '',
      },
      2: {
        description: draft.description ?? '',
        tags: draft.tags ?? [],
        languages: draft.languages ?? [],
        hasProductionPartner: draft.hasProductionPartner ?? false,
        productionPartnerDetails: draft.productionPartnerDetails ?? '',
      },
      3: {
        image: draft.image ?? '',
        bannerImage: draft.bannerImage ?? '',
      },
      4: {
        shippingOrigin: draft.shippingOrigin ?? {
          country: '',
          processingTimeDays: { min: 1, max: 3 },
          shipsInternational: false,
        },
        currency: draft.currency,
      },
      5: {
        policies: draft.policies ?? {
          returns: { accepted: false },
          exchanges: { accepted: false },
          customOrders: { accepted: false },
          paymentMethods: [],
        },
      },
      6: {
        socials: draft.socials.map((s) => ({ platform: s.platform, url: s.url })),
      },
      7: {
        // Listing step data is managed separately via product creation
      },
      8: {
        termsAgreed: false,
      },
    }
  })

  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const hasUnsavedChanges = useRef(false)
  const stepActions = useRef<Record<number, StepActions>>({})

  const updateSaveState = useCallback(
    (state: 'saved' | 'saving' | 'unsaved') => {
      onSaveStateChange?.(state)
    },
    [onSaveStateChange],
  )

  const updateField = useCallback(
    (step: number, field: string, value: unknown) => {
      setStepData((prev) => ({
        ...prev,
        [step]: { ...prev[step], [field]: value },
      }))
      hasUnsavedChanges.current = true
      updateSaveState('unsaved')
    },
    [updateSaveState],
  )

  const updateFields = useCallback(
    (step: number, fields: Record<string, unknown>) => {
      setStepData((prev) => ({
        ...prev,
        [step]: { ...prev[step], ...fields },
      }))
      hasUnsavedChanges.current = true
      updateSaveState('unsaved')
    },
    [updateSaveState],
  )

  const saveStep = useCallback(
    async (step: number, fields?: Record<string, unknown>) => {
      const dataToSave = fields ?? stepData[step] ?? {}
      if (!dataToSave || Object.keys(dataToSave).length === 0) return

      setIsSaving(true)
      updateSaveState('saving')

      try {
        await saveOnboardingStep({ data: { draftId: draft.id, step, data: dataToSave } })
        hasUnsavedChanges.current = false
        setLastSaved(new Date())
        updateSaveState('saved')
        // Reset saved indicator after 3s
        setTimeout(() => {
          if (!hasUnsavedChanges.current) {
            updateSaveState('saved')
          }
        }, 3000)
      } catch (err) {
        updateSaveState('unsaved')
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [draft.id, stepData, updateSaveState],
  )

  const getStepData = useCallback((step: number) => stepData[step] ?? {}, [stepData])

  const registerStepActions = useCallback((step: number, actions: StepActions | null) => {
    if (actions) {
      stepActions.current[step] = actions
    } else {
      delete stepActions.current[step]
    }
  }, [])

  const executeStepActions = useCallback(async (step: number) => {
    const actions = stepActions.current[step]
    if (!actions) return true
    const valid = actions.validate()
    if (!valid) return false
    await actions.save()
    return true
  }, [])

  const contextValue = useMemo(
    () => ({
      draft,
      updateField,
      updateFields,
      saveStep,
      isSaving,
      lastSaved,
      getStepData,
      registerStepActions,
      executeStepActions,
    }),
    [
      draft,
      updateField,
      updateFields,
      saveStep,
      isSaving,
      lastSaved,
      getStepData,
      registerStepActions,
      executeStepActions,
    ],
  )

  return <OnboardingContext.Provider value={contextValue}>{children}</OnboardingContext.Provider>
}
