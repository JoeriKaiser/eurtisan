import { useRouter } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export function CreatorPayoutsError({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-semibold text-text-primary'>
          {m.creator_payouts_title()}
        </h1>
        <div className='py-12 text-center'>
          <AlertTriangle size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <p className='text-text-secondary'>{m.creator_payouts_error_load()}</p>
          <p className='mt-2 text-sm text-text-muted'>{error.message}</p>
          <div className='mt-6'>
            <Button variant='secondary' onClick={() => void router.invalidate()}>
              {m.creator_error_retry()}
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
