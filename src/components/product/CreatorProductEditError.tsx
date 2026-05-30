import { useRouter } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'

export function CreatorProductEditError({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <main className='page-wrap px-4 py-8 sm:py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-semibold text-text-primary'>
          {m.creator_product_edit_title()}
        </h1>
        <div className='py-12 text-center'>
          <p className='text-text-secondary'>{m.creator_error_load()}</p>
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
