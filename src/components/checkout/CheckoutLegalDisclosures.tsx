import { Link } from '@tanstack/react-router'
import type { CheckoutShopGroup } from '#/lib/checkout.server'
import { formatPostalAddress } from '#/lib/shop-legal-identity'
import { m } from '#/paraglide/messages'

export interface CheckoutLegalDisclosuresProps {
  shops: CheckoutShopGroup[]
}

export function CheckoutLegalDisclosures({ shops }: CheckoutLegalDisclosuresProps) {
  return (
    <section
      className='mt-6 space-y-4 border-t border-border-default pt-6'
      aria-labelledby='checkout-legal-heading'
    >
      <h2 id='checkout-legal-heading' className='text-sm font-semibold text-text-primary'>
        {m.checkout_legal_heading()}
      </h2>

      <div className='space-y-3'>
        {shops.map((shop) => {
          const addressLine = formatPostalAddress(shop.sellerLegal.address)
          return (
            <div
              key={shop.shopId}
              className='rounded-xl border border-border-subtle bg-surface-inset/40 p-4 text-sm text-text-secondary'
            >
              <p className='font-medium text-text-primary'>{m.checkout_seller_identity_title()}</p>
              <p className='mt-1'>
                <span className='text-text-primary'>{shop.sellerLegal.tradeName}</span>
              </p>
              {addressLine && <p>{addressLine}</p>}
              <p>
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

      <p className='text-sm text-text-secondary leading-relaxed'>
        {m.checkout_withdrawal_notice()}
      </p>

      <p className='text-sm text-text-secondary leading-relaxed'>
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
    </section>
  )
}
