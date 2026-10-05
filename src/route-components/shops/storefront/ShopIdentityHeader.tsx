import { Flag, Globe, MapPin, Package } from 'lucide-react'
import { useState } from 'react'
import type { ProductReportReason } from '#/components/product/ReportProductDialog'
import { ReportShopDialog } from '#/components/shop/ReportShopDialog'
import { TraderStatusDisclosure } from '#/components/TraderStatusDisclosure'
import { formatDateLong } from '#/lib/format-date'
import { reportShop, type ShopProfile } from '#/lib/shop-profile'
import { m } from '#/paraglide/messages'
import { countryName, languageNames, productionTypeLabel } from './labels'
import { ShopRatingSummary } from './ShopRatingSummary'

export interface ShopIdentityHeaderProps {
  shop: ShopProfile
}

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className='flex items-center gap-2 text-sm text-text-secondary'>
      <span className='text-text-muted' aria-hidden='true'>
        {icon}
      </span>
      {children}
    </li>
  )
}

/**
 * The shop's name, tagline, and the facts a buyer weighs before browsing.
 *
 * Carries the page's only `<h1>`.
 *
 * The seller's own CRD trader-status declaration is shown beside this identity
 * and is never inferred from the separate DAC7 tax classification.
 */
export function ShopIdentityHeader({ shop }: ShopIdentityHeaderProps) {
  const languages = languageNames(shop.languages)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isReported, setIsReported] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const handleReportShop = async (reason: ProductReportReason, details: string | null) => {
    setReportBusy(true)
    setReportError(null)
    try {
      await reportShop({ data: { shopId: shop.id, reason, details } })
      setIsReported(true)
      setIsReportOpen(false)
    } catch {
      setReportError(m.review_report_error())
    } finally {
      setReportBusy(false)
    }
  }

  return (
    <header>
      <p className='island-kicker mb-3'>{m.shop_kicker()}</p>
      <h1 className='display-title mb-3 text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl'>
        {shop.name}
      </h1>

      {shop.tagline && (
        <p className='mb-5 max-w-2xl text-lg leading-relaxed text-text-secondary'>{shop.tagline}</p>
      )}

      <div className='mb-5 flex flex-wrap items-center gap-2'>
        {shop.productionType && (
          <span className='rounded-full bg-accent-primary-subtle px-3 py-0.5 text-sm font-medium text-accent-primary'>
            {productionTypeLabel(shop.productionType)}
          </span>
        )}
        <ShopRatingSummary rating={shop.rating} productCount={shop.productCount} />
      </div>
      <TraderStatusDisclosure traderStatus={shop.traderStatus} className='mb-5 max-w-2xl' />

      <ul className='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6'>
        {shop.origin && (
          <Fact icon={<MapPin size={15} />}>
            {m.shop_ships_from({ country: countryName(shop.origin.country) })}
          </Fact>
        )}
        {shop.origin?.processingTimeDays && (
          <Fact icon={<Package size={15} />}>
            {m.shop_processing_time({
              min: shop.origin.processingTimeDays.min,
              max: shop.origin.processingTimeDays.max,
            })}
          </Fact>
        )}
        {languages.length > 0 && (
          <Fact icon={<Globe size={15} />}>
            {m.shop_languages_label()} {languages.join(', ')}
          </Fact>
        )}
      </ul>

      <div className='mt-4 flex flex-wrap items-center justify-between gap-4'>
        <p className='text-sm text-text-muted'>
          {m.shop_member_since({ date: formatDateLong(shop.createdAt) })}
        </p>

        {isReported ? (
          <span
            className='inline-flex items-center gap-1.5 text-xs font-medium text-success'
            role='status'
          >
            <Flag size={14} aria-hidden='true' />
            {m.shop_report_success()}
          </span>
        ) : (
          <button
            type='button'
            onClick={() => setIsReportOpen(true)}
            className='inline-flex cursor-pointer items-center gap-1.5 text-xs text-text-tertiary transition hover:text-text-secondary hover:underline'
          >
            <Flag size={14} aria-hidden='true' />
            {m.shop_report_button()}
          </button>
        )}
      </div>

      <ReportShopDialog
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        shopName={shop.name}
        busy={reportBusy}
        error={reportError}
        onSubmit={handleReportShop}
      />
    </header>
  )
}
