import { Store } from 'lucide-react'
import { m } from '#/paraglide/messages'

export function ShopSettingsNotFoundState() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='py-12 text-center'>
          <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <h2 className='mb-2 text-xl font-semibold text-text-primary'>
            {m.creator_shop_not_found()}
          </h2>
          <p className='mx-auto max-w-md text-text-secondary'>
            {m.creator_shop_not_found_description()}
          </p>
        </div>
      </section>
    </main>
  )
}
