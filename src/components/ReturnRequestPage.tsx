import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, PackageCheck } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { createReturnRequest } from '#/lib/returns'
import type { OrderDetail } from '#/lib/orders'
import { m } from '#/paraglide/messages'

export function ReturnRequestPage({
  order,
  shopOrderId,
}: {
  order: OrderDetail
  shopOrderId: string
}) {
  const router = useRouter()
  const shop = order.shops.find((candidate) => candidate.shopOrderId === shopOrderId)
  const [type, setType] = useState<'withdrawal' | 'defective'>('withdrawal')
  const [reason, setReason] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [state, setState] = useState<{ submitting: boolean; error: string | null }>({
    submitting: false,
    error: null,
  })

  if (!shop) {
    return <p className='mx-auto max-w-2xl px-4 py-16'>{m.return_shop_not_found()}</p>
  }

  const selectedItems = shop.items
    .map((item) => ({ orderItemId: item.id, quantity: quantities[item.id] ?? 0 }))
    .filter((item) => item.quantity > 0)

  const submit = async () => {
    setState({ submitting: true, error: null })
    try {
      const result = await createReturnRequest({
        data: { shopOrderId, type, reason, items: selectedItems },
      })
      await router.navigate({
        to: '/returns/$returnRequestId',
        params: { returnRequestId: result.id },
      })
    } catch (error) {
      let message: string = m.return_request_error()
      if (error instanceof Response) {
        const body = (await error.json().catch(() => null)) as { message?: string } | null
        if (body?.message) message = body.message
      }
      setState({ submitting: false, error: message })
    }
  }

  return (
    <main className='mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12'>
      <button
        type='button'
        onClick={() => router.history.back()}
        className='mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-secondary'
      >
        <ArrowLeft size={18} aria-hidden='true' />
        {m.return_back_to_order()}
      </button>

      <div className='rounded-2xl border border-border-default bg-surface-elevated p-5 shadow-sm sm:p-8'>
        <div className='flex items-start gap-3'>
          <PackageCheck className='mt-1 text-accent-primary' aria-hidden='true' />
          <div>
            <h1 className='font-serif text-2xl font-semibold text-text-primary sm:text-3xl'>
              {m.return_request_title()}
            </h1>
            <p className='mt-2 text-sm leading-relaxed text-text-secondary'>
              {m.return_request_intro({ shop: shop.shopName })}
            </p>
          </div>
        </div>

        <fieldset className='mt-8'>
          <legend className='text-sm font-semibold text-text-primary'>
            {m.return_reason_type()}
          </legend>
          <div className='mt-3 grid gap-3 sm:grid-cols-2'>
            {(['withdrawal', 'defective'] as const).map((value) => (
              <label
                key={value}
                className='flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-border-default p-4 has-[:checked]:border-accent-primary has-[:checked]:bg-accent-primary/5'
              >
                <input
                  type='radio'
                  name='return-type'
                  value={value}
                  checked={type === value}
                  onChange={() => setType(value)}
                  className='mt-1 size-4 accent-accent-primary'
                />
                <span>
                  <span className='block text-sm font-semibold text-text-primary'>
                    {value === 'withdrawal'
                      ? m.return_type_withdrawal()
                      : m.return_type_defective()}
                  </span>
                  <span className='mt-1 block text-sm text-text-secondary'>
                    {value === 'withdrawal'
                      ? m.return_type_withdrawal_help()
                      : m.return_type_defective_help()}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className='mt-8'>
          <legend className='text-sm font-semibold text-text-primary'>
            {m.return_select_items()}
          </legend>
          <div className='mt-3 divide-y divide-border-subtle rounded-xl border border-border-default'>
            {shop.items.map((item) => {
              const quantity = quantities[item.id] ?? 0
              return (
                <div key={item.id} className='flex items-center gap-3 p-4'>
                  <label className='inline-flex size-11 shrink-0 items-center justify-center rounded-lg focus-within:ring-2 focus-within:ring-accent-secondary'>
                    <span className='sr-only'>
                      {m.return_select_item_label({ item: item.productName })}
                    </span>
                    <input
                      type='checkbox'
                      checked={quantity > 0}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [item.id]: event.currentTarget.checked ? 1 : 0,
                        }))
                      }
                      className='size-5 accent-accent-primary'
                    />
                  </label>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium text-text-primary'>
                      {item.productName}
                    </p>
                    <p className='text-sm text-text-muted'>
                      {m.return_ordered_quantity({ count: item.quantity })}
                    </p>
                  </div>
                  {item.quantity > 1 && quantity > 0 && (
                    <Input
                      type='number'
                      min={1}
                      max={item.quantity}
                      value={quantity}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [item.id]: Math.min(
                            item.quantity,
                            Math.max(1, Number(event.target.value)),
                          ),
                        }))
                      }
                      aria-label={m.return_quantity_label({ item: item.productName })}
                      className='w-20'
                    />
                  )}
                </div>
              )
            })}
          </div>
        </fieldset>

        <label
          htmlFor='return-reason'
          className='mt-8 block text-sm font-semibold text-text-primary'
        >
          {m.return_reason_details()}
        </label>
        <textarea
          id='return-reason'
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={10}
          maxLength={2000}
          rows={5}
          className='mt-2 w-full rounded-xl border border-border-default bg-surface p-3 text-base text-text-primary outline-none focus-visible:border-accent-primary focus-visible:ring-2 focus-visible:ring-accent-secondary/30'
          placeholder={m.return_reason_placeholder()}
        />

        <div className='mt-6 flex gap-3 rounded-xl bg-info/10 p-4 text-sm leading-relaxed text-text-secondary'>
          <AlertCircle className='mt-0.5 shrink-0 text-info' size={18} aria-hidden='true' />
          <p>
            {type === 'withdrawal' ? m.return_cost_buyer_notice() : m.return_cost_seller_notice()}
          </p>
        </div>

        {state.error && (
          <p role='alert' className='mt-4 text-sm text-error'>
            {state.error}
          </p>
        )}
        <Button
          size='lg'
          className='mt-6 w-full sm:w-auto'
          disabled={selectedItems.length === 0 || reason.trim().length < 10}
          isLoading={state.submitting}
          onClick={() => void submit()}
        >
          {m.return_submit_request()}
        </Button>
      </div>
    </main>
  )
}
