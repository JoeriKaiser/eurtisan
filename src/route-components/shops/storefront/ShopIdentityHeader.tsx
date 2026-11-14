import { Check, Flag, Globe, MapPin, Package, Share2 } from 'lucide-react'
import { useRef, useState } from 'react'
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
  const [copied, setCopied] = useState(false)
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const shareData = {
      title: shop.name,
      text: shop.tagline || shop.description || shop.name,
      url: window.location.href,
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare(shareData)
    ) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current)
        shareTimeoutRef.current = setTimeout(() => setCopied(false), 2500)
      } catch {
        // Clipboard write failed
      }
    }
  }

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
      <div className='flex items-start justify-between gap-4'>
        <div>
          <p className='island-kicker mb-3'>{m.shop_kicker()}</p>
          <h1 className='display-title mb-3 text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl'>
            {shop.name}
          </h1>
        </div>
        <button
          type='button'
          onClick={handleShare}
          aria-label={copied ? m.product_share_copied() : m.product_share()}
          title={copied ? m.product_share_copied() : m.product_share()}
          className='flex size-10 flex-shrink-0 items-center justify-center rounded-full border border-border-default bg-surface-default text-text-secondary transition hover:border-border-strong hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
        >
          {copied ? (
            <Check size={18} className='text-success' aria-hidden='true' />
          ) : (
            <Share2 size={18} aria-hidden='true' />
          )}
          <span className='sr-only' role='status'>
            {copied ? m.product_share_copied() : ''}
          </span>
        </button>
      </div>

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
