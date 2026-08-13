import { Clock3, FileCheck2, ShieldCheck, Store } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { CreateShopButton } from './CreateShopButton'

export function EmptyShopsState() {
  return (
    <section
      className='overflow-hidden rounded-2xl border border-border-default bg-surface-default'
      aria-labelledby='first-shop-title'
    >
      <div className='grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center'>
        <div>
          <Store size={40} className='mb-5 text-accent-primary' aria-hidden='true' />
          <h2 id='first-shop-title' className='display-title text-2xl text-text-primary'>
            {m.seller_hub_empty_title()}
          </h2>
          <p className='mt-3 max-w-xl text-text-secondary'>{m.seller_hub_empty_description()}</p>
          <div className='mt-6'>
            <CreateShopButton />
          </div>
        </div>
        <div className='divide-y divide-border-subtle rounded-xl bg-surface-inset px-4'>
          <div className='flex gap-3 py-4'>
            <Clock3 className='size-5 shrink-0 text-accent-primary' aria-hidden='true' />
            <div>
              <p className='text-sm font-semibold text-text-primary'>{m.seller_hub_time_title()}</p>
              <p className='mt-1 text-xs text-text-muted'>{m.seller_hub_time_description()}</p>
            </div>
          </div>
          <div className='flex gap-3 py-4'>
            <FileCheck2 className='size-5 shrink-0 text-accent-primary' aria-hidden='true' />
            <div>
              <p className='text-sm font-semibold text-text-primary'>
                {m.seller_hub_prepare_title()}
              </p>
              <p className='mt-1 text-xs text-text-muted'>{m.seller_hub_prepare_description()}</p>
            </div>
          </div>
          <div className='flex gap-3 py-4'>
            <ShieldCheck className='size-5 shrink-0 text-accent-primary' aria-hidden='true' />
            <div>
              <p className='text-sm font-semibold text-text-primary'>
                {m.seller_hub_launch_title()}
              </p>
              <p className='mt-1 text-xs text-text-muted'>{m.seller_hub_launch_description()}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
