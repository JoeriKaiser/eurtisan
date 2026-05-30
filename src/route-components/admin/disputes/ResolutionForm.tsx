import { useCallback, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { resolveDispute } from '#/lib/disputes'
import { formatPriceEUR } from '#/lib/pricing'

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function ResolutionForm({
  disputeId,
  orderTotalCents,
  orderStatus,
  onResolved,
}: {
  disputeId: string
  orderTotalCents: number
  orderStatus: string
  onResolved: () => void
}) {
  const [form, setForm] = useState({
    resolution: 'close' as 'close' | 'partial_refund' | 'full_refund',
    refundInput: '',
  })
  const [status, setStatus] = useState({
    isSubmitting: false,
    error: null as string | null,
    fieldError: null as string | null,
  })

  const refundCents = useMemo(() => {
    const parsed = Number.parseFloat(form.refundInput)
    if (Number.isNaN(parsed) || parsed < 0) return null
    return Math.round(parsed * 100)
  }, [form.refundInput])

  const validate = useCallback(() => {
    setStatus((prev) => ({ ...prev, fieldError: null }))
    if (form.resolution === 'partial_refund') {
      if (refundCents === null || refundCents <= 0) {
        setStatus((prev) => ({ ...prev, fieldError: 'Refund amount must be greater than 0' }))
        return false
      }
      if (refundCents > orderTotalCents) {
        setStatus((prev) => ({
          ...prev,
          fieldError: `Refund cannot exceed ${formatPriceEUR(orderTotalCents)}`,
        }))
        return false
      }
    }
    return true
  }, [form.resolution, refundCents, orderTotalCents])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return

      setStatus((prev) => ({ ...prev, isSubmitting: true, error: null }))

      try {
        await resolveDispute({
          data: {
            disputeId,
            resolution: form.resolution,
            refundCents: form.resolution === 'partial_refund' ? refundCents : null,
          },
        })
        onResolved()
      } catch (err) {
        if (err instanceof Response) {
          try {
            const body = await err.json()
            setStatus((prev) => ({
              ...prev,
              error: body.message || 'Failed to resolve dispute',
            }))
          } catch {
            setStatus((prev) => ({ ...prev, error: 'Failed to resolve dispute' }))
          }
        } else if (err instanceof Error) {
          setStatus((prev) => ({ ...prev, error: err.message }))
        } else {
          setStatus((prev) => ({ ...prev, error: 'An unexpected error occurred' }))
        }
      } finally {
        setStatus((prev) => ({ ...prev, isSubmitting: false }))
      }
    },
    [disputeId, form.resolution, refundCents, validate, onResolved],
  )

  const refundDisabled = form.resolution !== 'partial_refund'

  return (
    <Card variant='default'>
      <CardHeader>
        <CardTitle>Resolve Dispute</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label
              htmlFor='resolution-type'
              className='mb-1.5 block text-sm font-medium text-text-secondary'
            >
              Resolution
            </label>
            <select
              id='resolution-type'
              value={form.resolution}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  resolution: e.target.value as 'close' | 'partial_refund' | 'full_refund',
                }))
                setStatus((prev) => ({ ...prev, fieldError: null }))
              }}
              disabled={status.isSubmitting}
              className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:cursor-not-allowed disabled:opacity-50'
            >
              <option value='close'>Close (no action)</option>
              <option value='partial_refund'>Partial refund</option>
              <option value='full_refund' disabled={orderStatus === 'refunded'}>
                Full refund{orderStatus === 'refunded' ? ' — already refunded' : ''}
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor='refund-amount'
              className='mb-1.5 block text-sm font-medium text-text-secondary'
            >
              Refund amount (EUR)
            </label>
            <Input
              id='refund-amount'
              type='number'
              step='0.01'
              min='0.01'
              max={centsToEuros(orderTotalCents)}
              value={form.refundInput}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, refundInput: e.target.value }))
                if (status.fieldError) setStatus((prev) => ({ ...prev, fieldError: null }))
              }}
              placeholder='0.00'
              disabled={status.isSubmitting || refundDisabled}
              error={status.fieldError ?? undefined}
            />
            {status.fieldError && (
              <p id='refund-amount-error' className='mt-1 text-xs text-error'>
                {status.fieldError}
              </p>
            )}
            <p className='mt-1 text-xs text-text-muted'>
              Order total: {formatPriceEUR(orderTotalCents)}
            </p>
          </div>

          {status.error && (
            <div className='rounded-lg bg-error/10 p-3 text-sm text-error' role='alert'>
              {status.error}
            </div>
          )}

          <Button type='submit' isLoading={status.isSubmitting} className='w-full sm:w-auto'>
            Submit Resolution
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
