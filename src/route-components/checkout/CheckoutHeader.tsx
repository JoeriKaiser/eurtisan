import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { m } from '#/paraglide/messages'

/**
 * Page header for checkout: back link, title, and progress steps.
 */
export function CheckoutHeader() {
  return (
    <div className='mb-8 space-y-5'>
      <Link
        to='/cart'
        className='inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-text-secondary no-underline outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
      >
        <ArrowLeft size={16} aria-hidden='true' />
        {m.checkout_back_to_cart()}
      </Link>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <p className='mb-1 text-sm font-semibold text-accent-primary'>
            {m.checkout_secure_kicker()}
          </p>
          <h1 className='text-3xl font-semibold tracking-tight text-text-primary'>
            {m.checkout_title()}
          </h1>
        </div>
        <ol
          className='flex items-center gap-2 text-sm text-text-secondary'
          aria-label={m.checkout_progress_label()}
        >
          <li>{m.checkout_progress_cart()}</li>
          <li aria-hidden='true'>/</li>
          <li className='font-semibold text-text-primary' aria-current='step'>
            {m.checkout_progress_delivery()}
          </li>
          <li aria-hidden='true'>/</li>
          <li>{m.checkout_progress_payment()}</li>
        </ol>
      </div>
    </div>
  )
}
