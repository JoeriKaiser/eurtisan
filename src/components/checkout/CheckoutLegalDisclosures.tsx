import { Link } from '@tanstack/react-router'
import { TraderStatusDisclosure } from '#/components/TraderStatusDisclosure'
import type { CheckoutShopGroup } from '#/lib/checkout.server'
import { formatPostalAddress } from '#/lib/shop-legal-identity'
import { m } from '#/paraglide/messages'

export interface CheckoutLegalDisclosuresProps {
  shops: CheckoutShopGroup[]
}

export function CheckoutLegalDisclosures({ shops }: CheckoutLegalDisclosuresProps) {
  return (
    <section
      className='mt-6 border-t border-border-default pt-5'
      aria-labelledby='checkout-legal-heading'
    >
      <h2 id='checkout-legal-heading' className='text-sm font-semibold text-text-primary'>
        {m.checkout_rights_summary_title()}
      </h2>
      <p className='mt-2 text-sm leading-relaxed text-text-secondary'>
        {m.checkout_rights_summary()}
      </p>
      <div className='mt-4 space-y-3'>
        {shops.map((shop) => (
          <div key={shop.shopId}>
            <p className='mb-1 text-sm font-semibold text-text-primary'>
              {shop.sellerLegal.tradeName}
            </p>
            <TraderStatusDisclosure traderStatus={shop.sellerLegal.traderStatus} />
          </div>
        ))}
      </div>

      <details className='group mt-4 rounded-xl border border-border-subtle bg-surface-inset/40 open:bg-surface-inset'>
        <summary className='flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-secondary'>
          {m.checkout_legal_heading()}
          <span
            aria-hidden='true'
            className='text-text-muted transition-transform group-open:rotate-45'
          >
            +
          </span>
        </summary>
        <div className='space-y-4 border-t border-border-subtle px-4 py-4'>
          <div className='space-y-4'>
            {shops.map((shop) => {
              const addressLine = formatPostalAddress(shop.sellerLegal.address)
              return (
                <div key={shop.shopId} className='text-sm text-text-secondary'>
                  <p className='font-semibold text-text-primary'>{shop.sellerLegal.tradeName}</p>
                  {addressLine && <p className='mt-1'>{addressLine}</p>}
                  <p className='overflow-wrap-anywhere'>
                    {m.checkout_seller_contact_label()}:{' '}
                    <a
                      href={`mailto:${shop.sellerLegal.contactEmail}`}
                      className='text-accent-primary underline-offset-2 hover:underline'
                    >
                      {shop.sellerLegal.contactEmail}
                    </a>
                  </p>
                  {shop.sellerLegal.vatId && (
                    <p>
                      {m.checkout_seller_vat_label()}: {shop.sellerLegal.vatId}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <p className='text-sm leading-relaxed text-text-secondary'>
            {m.checkout_withdrawal_notice()}
          </p>
          <p className='text-sm leading-relaxed text-text-secondary'>
            {m.checkout_terms_notice_prefix()}{' '}
            <Link to='/terms' className='text-accent-primary underline-offset-2 hover:underline'>
              {m.footer_legal_terms()}
            </Link>{' '}
            {m.checkout_terms_notice_and()}{' '}
            <Link to='/privacy' className='text-accent-primary underline-offset-2 hover:underline'>
              {m.footer_legal_privacy()}
            </Link>
            .
          </p>
        </div>
      </details>
    </section>
  )
}
