import { getRouteApi } from '@tanstack/react-router'
import { Check, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'

const routeApi = getRouteApi('/mollie-mock-oauth')

export function MollieMockOauth() {
  const { shopId, state, redirect_uri } = routeApi.useSearch()
  const [connecting, setConnecting] = useState(false)

  const handleAuthorize = () => {
    setConnecting(true)
    // Simulate a brief API exchange time
    setTimeout(() => {
      const mockCode = `mock_code_${crypto.randomUUID().slice(0, 8)}`
      const target = `${redirect_uri}?code=${mockCode}&state=${encodeURIComponent(state || shopId)}`
      window.location.href = target
    }, 800)
  }

  const handleCancel = () => {
    // Redirect back to Creator Payouts dashboard directly
    window.location.href = `/creator/payouts?shopId=${encodeURIComponent(shopId)}`
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 text-slate-100 font-sans'>
      {/* Dynamic glow backgrounds */}
      <div className='pointer-events-none absolute inset-0 overflow-hidden'>
        <div className='absolute -left-40 -top-40 size-96 rounded-full bg-blue-600/10 blur-[100px]' />
        <div className='absolute -bottom-40 -right-40 size-96 rounded-full bg-indigo-600/10 blur-[100px]' />
      </div>

      <div className='relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl sm:p-8'>
        {/* Mollie Styled Header */}
        <div className='mb-8 flex items-center justify-between border-b border-slate-800 pb-5'>
          <div className='flex items-center gap-2.5'>
            {/* Styled custom Mollie logo element */}
            <div className='flex size-8 items-center justify-center rounded-lg bg-blue-600 font-black text-white tracking-tighter text-sm'>
              M
            </div>
            <span className='text-xl font-bold tracking-tight text-white'>
              mollie{' '}
              <span className='text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded'>
                Connect
              </span>
            </span>
          </div>
          <ShieldCheck size={20} className='text-blue-400' />
        </div>

        {/* Info */}
        <div className='text-center mb-6'>
          <div className='mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-blue-950/80 border border-blue-800/40 text-blue-400'>
            <ShieldCheck size={28} />
          </div>
          <h2 className='text-lg font-semibold text-white mb-2'>Authorize Eurtisan</h2>
          <p className='text-sm text-slate-400 leading-relaxed'>
            Eurtisan is requesting permission to link with your Mollie account to process customer
            payments and initiate payout transfers.
          </p>
        </div>

        {/* Permissions list */}
        <div className='mb-8 rounded-xl bg-slate-900/60 border border-slate-800 p-4'>
          <p className='mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500'>
            Requested Permissions:
          </p>
          <ul className='space-y-3 text-sm'>
            <li className='flex items-start gap-3'>
              <Check size={16} className='text-blue-400 shrink-0 mt-0.5' />
              <span className='text-slate-300'>
                <strong>payments.write</strong>: Create checkout orders on your behalf.
              </span>
            </li>
            <li className='flex items-start gap-3'>
              <Check size={16} className='text-blue-400 shrink-0 mt-0.5' />
              <span className='text-slate-300'>
                <strong>refunds.write</strong>: Issue payment refunds for customer disputes.
              </span>
            </li>
            <li className='flex items-start gap-3'>
              <Check size={16} className='text-blue-400 shrink-0 mt-0.5' />
              <span className='text-slate-300'>
                <strong>organizations.read</strong>: View organization details and retrieve your
                merchant profile ID.
              </span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className='flex flex-col gap-3 sm:flex-row sm:justify-end'>
          <button
            type='button'
            onClick={handleCancel}
            disabled={connecting}
            className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-400 transition-colors hover:bg-slate-900 hover:text-white disabled:opacity-50'
          >
            <X size={16} />
            Cancel
          </button>
          <Button
            type='button'
            onClick={handleAuthorize}
            disabled={connecting}
            className='inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-6 py-2.5 transition-all shadow-lg shadow-blue-600/20'
          >
            {connecting ? (
              <div className='size-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
            ) : (
              <ShieldCheck size={16} />
            )}
            Authorize Access
          </Button>
        </div>

        {/* Footer */}
        <p className='mt-8 text-center text-xs text-slate-500'>
          This is a simulated sandbox authorization page for local testing.
        </p>
      </div>
    </div>
  )
}
