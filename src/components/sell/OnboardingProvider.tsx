import type React from 'react'
import { createContext, use, useCallback, useMemo, useRef, useState } from 'react'
import type { ShopDraft } from '#/lib/sell-onboarding'
import { saveOnboardingStep } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'
import { trackEvent } from '#/integrations/umami'

interface StepActions {
  validate: () => boolean
  save: () => Promise<void>
}

interface OnboardingContextType {
  draft: ShopDraft
  updateField: (step: number, field: string, value: unknown) => void
  updateFields: (step: number, fields: Record<string, unknown>) => void
  saveStep: (step: number, fields?: Record<string, unknown>) => Promise<void>
  runSave: <T>(operation: () => Promise<T>) => Promise<T>
  isSaving: boolean
  isDirty: boolean
  saveError: string | null
  getStepData: (step: number) => Record<string, unknown>
  registerStepActions: (step: number, actions: StepActions | null) => void
  executeStepActions: (step: number) => Promise<boolean>
  clearSaveError: () => void
}

const OnboardingContext = createContext<OnboardingContextType | null>(null)

export function useOnboarding() {
  const context = use(OnboardingContext)
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider')
  return context
}

interface OnboardingListingData {
  id: string
  name: string
  slug: string
  description: string | null
  priceCents: number
  stockCount: number
  categoryId: string | null
  vatRateCategory: string
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  images: Array<{ key: string; altText: string | null; sortOrder: number }>
}

interface Props {
  draft: ShopDraft
  listing: OnboardingListingData | null
  onSaveStateChange?: (state: 'saved' | 'saving' | 'unsaved' | 'error') => void
  children: React.ReactNode
}

export function OnboardingProvider({ draft, listing, onSaveStateChange, children }: Props) {
  const [stepData, setStepData] = useState<Record<number, Record<string, unknown>>>(() => ({
    1: {
      name: draft.name,
      slug: draft.slug.startsWith('draft-') ? '' : draft.slug,
      tagline: draft.tagline ?? '',
      category: draft.category ?? '',
      productionType: draft.productionType ?? '',
      description: draft.description ?? '',
      hasProductionPartner: draft.hasProductionPartner ?? false,
      productionPartnerDetails: draft.productionPartnerDetails ?? '',
      image: draft.image ?? '',
    },
    2: {
      shippingOrigin: draft.shippingOrigin ?? {
        country: '',
        city: '',
        postalCode: '',
        processingTimeDays: { min: 1, max: 3 },
        shipsInternational: false,
      },
      businessAddress: draft.businessAddress ?? {
        street: '',
        city: '',
        postalCode: '',
        country: '',
      },
      currency: draft.currency,
      isVatRegistered: draft.isVatRegistered,
      vatId: draft.vatId ?? '',
      legalEntityType: draft.legalEntityType ?? 'individual',
      dateOfBirth: draft.dateOfBirth ?? '',
      taxId: draft.taxId ?? '',
      businessRegistrationNumber: draft.businessRegistrationNumber ?? '',
    },
    3: {
      productId: listing?.id,
      name: listing?.name ?? '',
      slug: listing?.slug ?? '',
      description: listing?.description ?? '',
      price: listing?.priceCents ? (listing.priceCents / 100).toFixed(2) : '',
      stockCount: listing?.stockCount ? String(listing.stockCount) : '1',
      categoryId: listing?.categoryId ?? '',
      vatRateCategory:
        listing?.vatRateCategory === 'reduced' || listing?.vatRateCategory === 'exempt'
          ? listing.vatRateCategory
          : 'standard',
      weightGrams: listing?.weightGrams ? String(listing.weightGrams) : '',
      lengthCm: listing?.lengthCm ? String(listing.lengthCm) : '',
      widthCm: listing?.widthCm ? String(listing.widthCm) : '',
      heightCm: listing?.heightCm ? String(listing.heightCm) : '',
      images:
        listing?.images.map((image) => ({
          key: image.key,
          altText: image.altText ?? undefined,
        })) ?? [],
    },
    4: {
      shippingOrigin: draft.shippingOrigin ?? {
        country: '',
        city: '',
        postalCode: '',
        processingTimeDays: { min: 1, max: 3 },
        shipsInternational: false,
      },
      policies: draft.policies ?? {
        returns: { accepted: true, windowDays: 14 },
        exchanges: { accepted: true, windowDays: 14 },
        customOrders: { accepted: false },
        paymentMethods: [],
        mandatoryRightsAcknowledged: false,
      },
    },
    5: {
      termsAgreed: false,
    },
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const stepActions = useRef<Record<number, StepActions>>({})

  const setSaveState = useCallback(
    (state: 'saved' | 'saving' | 'unsaved' | 'error') => onSaveStateChange?.(state),
    [onSaveStateChange],
  )

  const markDirty = useCallback(() => {
    setIsDirty(true)
    setSaveError(null)
    setSaveState('unsaved')
  }, [setSaveState])

  const updateField = useCallback(
    (step: number, field: string, value: unknown) => {
      setStepData((previous) => {
        const next = { ...previous, [step]: { ...previous[step], [field]: value } }
        if (field === 'shippingOrigin' && (step === 2 || step === 4)) {
          const counterpart = step === 2 ? 4 : 2
          next[counterpart] = { ...previous[counterpart], shippingOrigin: value }
        }
        return next
      })
      markDirty()
    },
    [markDirty],
  )

  const updateFields = useCallback(
    (step: number, fields: Record<string, unknown>) => {
      setStepData((previous) => {
        const next = { ...previous, [step]: { ...previous[step], ...fields } }
        if ('shippingOrigin' in fields && (step === 2 || step === 4)) {
          const counterpart = step === 2 ? 4 : 2
          next[counterpart] = { ...previous[counterpart], shippingOrigin: fields.shippingOrigin }
        }
        return next
      })
      markDirty()
    },
    [markDirty],
  )

  const runSave = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      setIsSaving(true)
      setSaveError(null)
      setSaveState('saving')
      try {
        const result = await operation()
        setIsDirty(false)
        setSaveState('saved')
        return result
      } catch (error) {
        void trackEvent('seller_onboarding_save_failed')
        setIsDirty(true)
        setSaveError(m.onboarding_error_save_failed())
        setSaveState('error')
        throw error
      } finally {
        setIsSaving(false)
      }
    },
    [setSaveState],
  )

  const saveStep = useCallback(
    async (step: number, fields?: Record<string, unknown>) => {
      const dataToSave = fields ?? stepData[step] ?? {}
      await runSave(() =>
        saveOnboardingStep({ data: { draftId: draft.id, step, data: dataToSave } }),
      )
    },
    [draft.id, runSave, stepData],
  )

  const getStepData = useCallback((step: number) => stepData[step] ?? {}, [stepData])

  const registerStepActions = useCallback((step: number, actions: StepActions | null) => {
    if (actions) stepActions.current[step] = actions
    else delete stepActions.current[step]
  }, [])

  const executeStepActions = useCallback(async (step: number) => {
    const actions = stepActions.current[step]
    if (!actions) return true
    if (!actions.validate()) return false
    await actions.save()
    return true
  }, [])

  const clearSaveError = useCallback(() => setSaveError(null), [])

  const value = useMemo(
    () => ({
      draft,
      updateField,
      updateFields,
      saveStep,
      runSave,
      isSaving,
      isDirty,
      saveError,
      getStepData,
      registerStepActions,
      executeStepActions,
      clearSaveError,
    }),
    [
      draft,
      updateField,
      updateFields,
      saveStep,
      runSave,
      isSaving,
      isDirty,
      saveError,
      getStepData,
      registerStepActions,
      executeStepActions,
      clearSaveError,
    ],
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}
