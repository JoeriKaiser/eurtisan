import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { requestGuestOrderAccess } from '#/lib/checkout/guest-access'
import { m } from '#/paraglide/messages'

export function GuestOrderAccessPage({ invalidLink = false }: { invalidLink?: boolean }) {
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ loading: false, sent: false, error: false })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setState({ loading: true, sent: false, error: false })
    try {
      await requestGuestOrderAccess({ data: { orderNumber, email } })
      setState({ loading: false, sent: true, error: false })
    } catch {
      setState({ loading: false, sent: false, error: true })
    }
  }

  return (
    <main className='page-wrap px-4 py-16'>
      <div className='mx-auto max-w-md rounded-2xl border border-border-default bg-surface-elevated p-6 shadow-sm sm:p-8'>
        <h1 className='font-serif text-2xl font-semibold text-text-primary'>
          {m.guest_order_access_title()}
        </h1>
        <p className='mt-2 text-sm leading-relaxed text-text-secondary'>
          {invalidLink ? m.guest_order_access_invalid() : m.guest_order_access_intro()}
        </p>
        <form onSubmit={(event) => void submit(event)} className='mt-6 space-y-4'>
          <div>
            <Label htmlFor='guest-order-number'>{m.guest_order_access_order_number()}</Label>
            <Input
              id='guest-order-number'
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              autoComplete='off'
              required
            />
          </div>
          <div>
            <Label htmlFor='guest-order-email'>{m.checkout_field_email()}</Label>
            <Input
              id='guest-order-email'
              type='email'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete='email'
              required
            />
          </div>
          <Button type='submit' size='lg' className='w-full' isLoading={state.loading}>
            {m.guest_order_access_send()}
          </Button>
        </form>
        {state.sent && (
          <p role='status' className='mt-4 text-sm text-success'>
            {m.guest_order_access_sent()}
          </p>
        )}
        {state.error && (
          <p role='alert' className='mt-4 text-sm text-error'>
            {m.guest_order_access_error()}
          </p>
        )}
      </div>
    </main>
  )
}
