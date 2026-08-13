import { useRouter } from '@tanstack/react-router'
import { ImageIcon } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'

export function ProductNewNoShopState() {
  const router = useRouter()

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='py-12 text-center'>
          <ImageIcon size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <h2 className='mb-2 text-xl font-semibold text-text-primary'>
            {m.creator_product_new_no_shops_title()}
          </h2>
          <p className='mx-auto max-w-md text-text-secondary'>
            {m.creator_product_new_no_shops_description()}
          </p>
          <div className='mt-6'>
            <Button variant='primary' onClick={() => router.navigate({ to: '/creator/shop' })}>
              {m.creator_shop_settings_title()}
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
