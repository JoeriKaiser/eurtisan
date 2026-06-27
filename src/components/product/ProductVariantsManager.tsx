import { Edit3, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import {
  createProductOption,
  deleteProductOption,
  deleteProductVariant,
  ensureVariantMatrix,
  getProductVariantMatrix,
  type ProductVariantMatrix,
  updateProductOption,
  updateProductVariant,
} from '#/lib/product-variants'
import { m } from '#/paraglide/messages'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'

interface VariantDraft {
  name: string
  sku: string
  priceAdjustment: string
  stockCount: string
  isActive: boolean
}

interface ProductVariantsManagerProps {
  productId: string
  initialMatrix: ProductVariantMatrix
}

function formatCentsToEuro(cents: number): string {
  return (cents / 100).toFixed(2)
}

function parseEuroToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (normalized === '' || normalized === '-' || normalized === '+') return 0
  const num = Number.parseFloat(normalized)
  if (Number.isNaN(num)) return null
  return Math.round(num * 100)
}

function parseStock(value: string): number | null {
  if (value.trim() === '') return 0
  const num = Number.parseInt(value.trim(), 10)
  if (Number.isNaN(num) || num < 0) return null
  return num
}

function valuesToString(values: { value: string }[]): string {
  return values.map((v) => v.value).join(', ')
}

export function ProductVariantsManager({ productId, initialMatrix }: ProductVariantsManagerProps) {
  const [matrix, setMatrix] = useState<ProductVariantMatrix>(initialMatrix)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  const [addingOption, setAddingOption] = useState(false)
  const [optionName, setOptionName] = useState('')
  const [optionValues, setOptionValues] = useState('')
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null)
  const [editOptionName, setEditOptionName] = useState('')
  const [editOptionValues, setEditOptionValues] = useState('')

  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantDraft>>(() =>
    Object.fromEntries(
      initialMatrix.variants.map((v) => [
        v.id,
        {
          name: v.name,
          sku: v.sku ?? '',
          priceAdjustment: formatCentsToEuro(v.priceAdjustmentCents),
          stockCount: String(v.stockCount),
          isActive: v.isActive,
        },
      ]),
    ),
  )

  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null)
  const [deleteOptionId, setDeleteOptionId] = useState<string | null>(null)

  const refreshMatrix = async () => {
    const next = await getProductVariantMatrix({ data: { productId } })
    setMatrix(next)
    setVariantDrafts(
      Object.fromEntries(
        next.variants.map((v) => [
          v.id,
          {
            name: v.name,
            sku: v.sku ?? '',
            priceAdjustment: formatCentsToEuro(v.priceAdjustmentCents),
            stockCount: String(v.stockCount),
            isActive: v.isActive,
          },
        ]),
      ),
    )
  }

  const showSuccess = (message: string) => {
    setFeedback({ type: 'success', message })
    window.setTimeout(() => setFeedback(null), 4000)
  }

  const showError = (message: string) => {
    setFeedback({ type: 'error', message })
  }

  const handleAddOption = async () => {
    const name = optionName.trim()
    const values = optionValues.split(',').flatMap((v) => {
      const trimmed = v.trim()
      return trimmed ? [trimmed] : []
    })

    if (!name || values.length === 0) {
      showError(m.creator_product_variants_error_option())
      return
    }

    setLoading(true)
    try {
      await createProductOption({ data: { productId, name, values } })
      await refreshMatrix()
      setOptionName('')
      setOptionValues('')
      setAddingOption(false)
      showSuccess(m.creator_product_variants_success_option_saved())
    } catch {
      showError(m.creator_product_variants_error_option())
    } finally {
      setLoading(false)
    }
  }

  const startEditOption = (optionId: string) => {
    const option = matrix.options.find((o) => o.id === optionId)
    if (!option) return
    setEditingOptionId(optionId)
    setEditOptionName(option.name)
    setEditOptionValues(valuesToString(option.values))
  }

  const handleUpdateOption = async () => {
    if (!editingOptionId) return
    const name = editOptionName.trim()
    const values = editOptionValues.split(',').flatMap((v) => {
      const trimmed = v.trim()
      return trimmed ? [trimmed] : []
    })

    if (!name || values.length === 0) {
      showError(m.creator_product_variants_error_option())
      return
    }

    setLoading(true)
    try {
      await updateProductOption({ data: { optionId: editingOptionId, name, values } })
      await refreshMatrix()
      setEditingOptionId(null)
      showSuccess(m.creator_product_variants_success_option_saved())
    } catch {
      showError(m.creator_product_variants_error_option())
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteOption = async () => {
    if (!deleteOptionId) return
    setLoading(true)
    try {
      await deleteProductOption({ data: { optionId: deleteOptionId } })
      await refreshMatrix()
      setDeleteOptionId(null)
      showSuccess(m.creator_product_variants_success_option_saved())
    } catch {
      showError(m.creator_product_variants_error_option())
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateVariants = async () => {
    setLoading(true)
    try {
      const next = await ensureVariantMatrix({ data: { productId } })
      setMatrix(next)
      setVariantDrafts(
        Object.fromEntries(
          next.variants.map((v) => [
            v.id,
            {
              name: v.name,
              sku: v.sku ?? '',
              priceAdjustment: formatCentsToEuro(v.priceAdjustmentCents),
              stockCount: String(v.stockCount),
              isActive: v.isActive,
            },
          ]),
        ),
      )
      const generated = next.variants.length - matrix.variants.length
      showSuccess(
        generated > 0
          ? m.creator_product_variants_success_generated({ count: String(generated) })
          : m.creator_product_variants_success_option_saved(),
      )
    } catch {
      showError(m.creator_product_variants_error_save())
    } finally {
      setLoading(false)
    }
  }

  const updateDraft = (variantId: string, patch: Partial<VariantDraft>) => {
    setVariantDrafts((prev) => {
      const base = prev[variantId] ?? ({} as VariantDraft)
      return { ...prev, [variantId]: { ...base, ...patch } }
    })
  }

  const handleSaveVariant = async (variantId: string) => {
    const draft = variantDrafts[variantId]
    if (!draft) return

    const priceAdjustmentCents = parseEuroToCents(draft.priceAdjustment)
    if (priceAdjustmentCents === null) {
      showError(m.creator_product_new_price_required())
      return
    }
    const stockCount = parseStock(draft.stockCount)
    if (stockCount === null) {
      showError(m.creator_product_new_stock_negative())
      return
    }
    const name = draft.name.trim()
    if (!name) {
      showError(m.creator_product_new_name_required())
      return
    }

    const existing = matrix.variants.find((v) => v.id === variantId)
    if (!existing) return

    setLoading(true)
    try {
      await updateProductVariant({
        data: {
          variantId,
          name,
          sku: draft.sku.trim() || null,
          priceAdjustmentCents,
          stockCount,
          isActive: draft.isActive,
          optionValueIds: existing.optionValueIds,
        },
      })
      await refreshMatrix()
      showSuccess(m.creator_product_variants_success_variant_saved())
    } catch {
      showError(m.creator_product_variants_error_save())
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteVariant = async () => {
    if (!deleteVariantId) return
    setLoading(true)
    try {
      await deleteProductVariant({ data: { variantId: deleteVariantId } })
      await refreshMatrix()
      setDeleteVariantId(null)
      showSuccess(m.creator_product_variants_success_variant_deleted())
    } catch {
      showError(m.creator_product_variants_error_delete())
    } finally {
      setLoading(false)
    }
  }

  const hasOptions = matrix.options.length > 0

  return (
    <section className='island-shell mt-8 rounded-2xl p-6 sm:p-8'>
      <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='text-xl font-semibold text-text-primary'>
            {m.creator_product_variants_title()}
          </h2>
          <p className='text-sm text-text-secondary'>{m.creator_product_variants_description()}</p>
        </div>
        {hasOptions && (
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={handleGenerateVariants}
            isLoading={loading}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden='true' />
            {m.creator_product_variants_generate()}
          </Button>
        )}
      </div>

      {feedback && <FeedbackBanner type={feedback.type} message={feedback.message} />}

      {/* Options */}
      <div className='mb-8'>
        <h3 className='mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary'>
          {m.creator_product_variants_options_title()}
        </h3>

        {matrix.options.length === 0 && !addingOption && (
          <p className='mb-4 text-sm text-text-secondary'>
            {m.creator_product_variants_options_empty()}
          </p>
        )}

        <ul className='mb-4 space-y-3'>
          {matrix.options.map((option) => (
            <li
              key={option.id}
              className='flex items-start justify-between gap-4 rounded-xl border border-border-subtle bg-surface-default p-4'
            >
              {editingOptionId === option.id ? (
                <div className='grid flex-1 gap-3 sm:grid-cols-2'>
                  <div>
                    <Label htmlFor={`option-name-${option.id}`}>
                      {m.creator_product_variants_option_name_label()}
                    </Label>
                    <Input
                      id={`option-name-${option.id}`}
                      value={editOptionName}
                      onChange={(e) => setEditOptionName(e.target.value)}
                      placeholder={m.creator_product_variants_option_name_placeholder()}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`option-values-${option.id}`}>
                      {m.creator_product_variants_option_values_label()}
                    </Label>
                    <Input
                      id={`option-values-${option.id}`}
                      value={editOptionValues}
                      onChange={(e) => setEditOptionValues(e.target.value)}
                      placeholder={m.creator_product_variants_option_values_placeholder()}
                    />
                  </div>
                </div>
              ) : (
                <div className='flex-1'>
                  <p className='font-medium text-text-primary'>{option.name}</p>
                  <p className='text-sm text-text-secondary'>
                    {option.values.map((v) => v.value).join(', ')}
                  </p>
                </div>
              )}

              <div className='flex items-center gap-2'>
                {editingOptionId === option.id ? (
                  <>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => setEditingOptionId(null)}
                      disabled={loading}
                    >
                      <X size={16} aria-hidden='true' />
                      <span className='sr-only'>{m.creator_product_variants_cancel()}</span>
                    </Button>
                    <Button
                      type='button'
                      variant='primary'
                      size='sm'
                      onClick={handleUpdateOption}
                      isLoading={loading}
                      disabled={loading}
                    >
                      <Save size={16} aria-hidden='true' />
                      {m.creator_product_variants_save_option()}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => startEditOption(option.id)}
                      disabled={loading}
                    >
                      <Edit3 size={16} aria-hidden='true' />
                      <span className='sr-only'>{m.creator_product_variants_edit_option()}</span>
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => setDeleteOptionId(option.id)}
                      disabled={loading}
                    >
                      <Trash2 size={16} aria-hidden='true' />
                      <span className='sr-only'>{m.creator_product_variants_delete_option()}</span>
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {addingOption ? (
          <div className='rounded-xl border border-border-subtle bg-surface-default p-4'>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div>
                <Label htmlFor='new-option-name'>
                  {m.creator_product_variants_option_name_label()}
                </Label>
                <Input
                  id='new-option-name'
                  value={optionName}
                  onChange={(e) => setOptionName(e.target.value)}
                  placeholder={m.creator_product_variants_option_name_placeholder()}
                />
              </div>
              <div>
                <Label htmlFor='new-option-values'>
                  {m.creator_product_variants_option_values_label()}
                </Label>
                <Input
                  id='new-option-values'
                  value={optionValues}
                  onChange={(e) => setOptionValues(e.target.value)}
                  placeholder={m.creator_product_variants_option_values_placeholder()}
                />
              </div>
            </div>
            <div className='mt-3 flex items-center gap-2'>
              <Button
                type='button'
                variant='primary'
                size='sm'
                onClick={handleAddOption}
                isLoading={loading}
                disabled={loading}
              >
                <Plus size={16} aria-hidden='true' />
                {m.creator_product_variants_add_option()}
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                  setAddingOption(false)
                  setOptionName('')
                  setOptionValues('')
                }}
                disabled={loading}
              >
                {m.creator_product_variants_cancel()}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={() => setAddingOption(true)}
            disabled={loading}
          >
            <Plus size={16} aria-hidden='true' />
            {m.creator_product_variants_add_option()}
          </Button>
        )}
      </div>

      {/* Variant matrix */}
      <div>
        <h3 className='mb-3 text-sm font-medium uppercase tracking-wide text-text-secondary'>
          {m.creator_product_variants_matrix_title()}
        </h3>

        {matrix.variants.length === 0 ? (
          <p className='text-sm text-text-secondary'>{m.creator_product_variants_matrix_empty()}</p>
        ) : (
          <div className='overflow-x-auto rounded-xl border border-border-subtle'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-surface-inset text-text-secondary'>
                <tr>
                  <th className='px-4 py-3 font-medium'>
                    {m.creator_product_variants_col_variant()}
                  </th>
                  <th className='px-4 py-3 font-medium'>{m.creator_product_variants_col_sku()}</th>
                  <th className='px-4 py-3 font-medium'>
                    {m.creator_product_variants_col_price_adjustment()}
                  </th>
                  <th className='px-4 py-3 font-medium'>
                    {m.creator_product_variants_col_stock()}
                  </th>
                  <th className='px-4 py-3 font-medium'>
                    {m.creator_product_variants_col_active()}
                  </th>
                  <th className='px-4 py-3 font-medium'>
                    {m.creator_product_variants_col_actions()}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border-subtle'>
                {matrix.variants.map((variant) => {
                  const draft = variantDrafts[variant.id]
                  if (!draft) return null
                  const isDirty =
                    draft.name !== variant.name ||
                    draft.sku !== (variant.sku ?? '') ||
                    parseEuroToCents(draft.priceAdjustment) !== variant.priceAdjustmentCents ||
                    parseStock(draft.stockCount) !== variant.stockCount ||
                    draft.isActive !== variant.isActive

                  return (
                    <tr key={variant.id} className='bg-surface-default'>
                      <td className='px-4 py-3'>
                        <Input
                          aria-label={m.creator_product_variants_col_variant()}
                          value={draft.name}
                          onChange={(e) => updateDraft(variant.id, { name: e.target.value })}
                          className='min-w-[10rem]'
                        />
                      </td>
                      <td className='px-4 py-3'>
                        <Input
                          aria-label={m.creator_product_variants_col_sku()}
                          value={draft.sku}
                          onChange={(e) => updateDraft(variant.id, { sku: e.target.value })}
                          placeholder={m.creator_product_variants_sku_placeholder()}
                          className='min-w-[8rem]'
                        />
                      </td>
                      <td className='px-4 py-3'>
                        <Input
                          aria-label={m.creator_product_variants_col_price_adjustment()}
                          value={draft.priceAdjustment}
                          onChange={(e) =>
                            updateDraft(variant.id, { priceAdjustment: e.target.value })
                          }
                          placeholder={m.creator_product_variants_price_adjustment_placeholder()}
                          className='min-w-[8rem]'
                        />
                      </td>
                      <td className='px-4 py-3'>
                        <Input
                          aria-label={m.creator_product_variants_col_stock()}
                          type='number'
                          min={0}
                          value={draft.stockCount}
                          onChange={(e) => updateDraft(variant.id, { stockCount: e.target.value })}
                          placeholder={m.creator_product_variants_stock_placeholder()}
                          className='min-w-[6rem]'
                        />
                      </td>
                      <td className='px-4 py-3'>
                        <Switch
                          checked={draft.isActive}
                          onCheckedChange={(checked) =>
                            updateDraft(variant.id, { isActive: checked })
                          }
                        />
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex items-center gap-2'>
                          <Button
                            type='button'
                            variant='primary'
                            size='sm'
                            onClick={() => handleSaveVariant(variant.id)}
                            isLoading={loading}
                            disabled={loading || !isDirty}
                          >
                            <Save size={16} aria-hidden='true' />
                            <span className='sr-only'>
                              {m.creator_product_variants_save_variant()}
                            </span>
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => setDeleteVariantId(variant.id)}
                            disabled={loading}
                          >
                            <Trash2 size={16} aria-hidden='true' />
                            <span className='sr-only'>
                              {m.creator_product_variants_delete_variant()}
                            </span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmationDialog
        open={deleteVariantId !== null}
        title={m.creator_product_variants_delete_variant()}
        description={m.creator_product_variants_delete_variant_confirm()}
        cancelLabel={m.creator_product_variants_cancel()}
        confirmLabel={m.creator_product_variants_delete_variant()}
        deleting={loading}
        onCancel={() => setDeleteVariantId(null)}
        onConfirm={handleDeleteVariant}
      />

      <DeleteConfirmationDialog
        open={deleteOptionId !== null}
        title={m.creator_product_variants_delete_option()}
        description={m.creator_product_variants_delete_option_confirm()}
        cancelLabel={m.creator_product_variants_cancel()}
        confirmLabel={m.creator_product_variants_delete_option()}
        deleting={loading}
        onCancel={() => setDeleteOptionId(null)}
        onConfirm={handleDeleteOption}
      />
    </section>
  )
}
