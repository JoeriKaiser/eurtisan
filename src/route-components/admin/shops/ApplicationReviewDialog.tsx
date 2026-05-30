import { CheckCircle, ExternalLink, Globe, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '#/components/ui/primitives/dialog'
import { Skeleton } from '#/components/ui/skeleton'
import { getShopDraft, getShopDraftListings, type ShopDraft } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'

const PRICE_FORMATTER = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
})

function formatPrice(cents: number): string {
  return PRICE_FORMATTER.format(cents / 100)
}

interface AppListing {
  id: string
  name: string
  description: string | null
  priceCents: number
  stockCount: number
  imageCount: number
  thumbnailUrl: string | null
}

interface DetailState {
  details: ShopDraft | null
  listings: AppListing[]
  isLoading: boolean
  error: string | null
}

interface ApplicationReviewDialogProps {
  appId: string | null
  onClose: () => void
  onReviewAction: (action: 'approve' | 'request_changes' | 'reject', note: string) => void
  isProcessing: boolean
  actionType: 'approve' | 'request_changes' | 'reject' | null
}

export function ApplicationReviewDialog({
  appId,
  onClose,
  onReviewAction,
  isProcessing,
  actionType,
}: ApplicationReviewDialogProps) {
  const [state, setState] = useState<DetailState>({
    details: null,
    listings: [],
    isLoading: !!appId,
    error: null,
  })
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!appId) return

    let cancelled = false

    Promise.all([
      getShopDraft({ data: { draftId: appId } }),
      getShopDraftListings({ data: { shopId: appId } }),
    ])
      .then(([details, listings]) => {
        if (cancelled) return
        setState({
          details,
          listings: listings.products || [],
          isLoading: false,
          error: null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          details: null,
          listings: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load details',
        })
      })

    return () => {
      cancelled = true
    }
  }, [appId])

  const handleAction = (action: 'approve' | 'request_changes' | 'reject') => {
    onReviewAction(action, note.trim())
  }

  const { details, listings, isLoading, error } = state

  return (
    <Dialog open={!!appId} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className='max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0'>
          <div className='flex items-center justify-between border-b border-border-subtle px-6 py-4 flex-shrink-0'>
            <DialogTitle className='text-xl'>
              {isLoading || !details
                ? m.admin_shops_review_details()
                : m.admin_shops_application_details_title({ name: details.name })}
            </DialogTitle>
            <button
              type='button'
              onClick={onClose}
              className='rounded p-1 text-text-muted hover:bg-bg-inset hover:text-text-primary transition-colors'
              aria-label={m.admin_shops_cancel()}
            >
              <X size={18} />
            </button>
          </div>

          <div className='overflow-y-auto flex-1 min-h-0 px-6 py-4'>
            {isLoading || !details ? (
              <div className='space-y-6 py-4'>
                <Skeleton className='size-8/3' />
                <Skeleton className='h-32 w-full rounded-xl' />
                <Skeleton className='h-32 w-full rounded-xl' />
              </div>
            ) : error ? (
              <div className='rounded-lg border border-error/30 bg-error-subtle p-4 text-sm text-error'>
                {error}
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-3 gap-6 py-2'>
                {/* Shop details columns */}
                <div className='md:col-span-2 space-y-6'>
                  {/* Identity */}
                  <div className='space-y-2'>
                    <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
                      {m.admin_shops_application_section_identity()}
                    </h3>
                    <div className='bg-surface-inset rounded-xl p-4 space-y-3 border border-border-subtle'>
                      <div>
                        <p className='text-xs text-text-muted'>{m.admin_shops_col_name()}</p>
                        <p className='text-sm font-semibold text-text-primary'>{details.name}</p>
                      </div>
                      <div>
                        <p className='text-xs text-text-muted'>Slug</p>
                        <p className='text-sm font-mono text-text-primary'>/shops/{details.slug}</p>
                      </div>
                      {details.tagline && (
                        <div>
                          <p className='text-xs text-text-muted'>
                            {m.admin_shops_application_field_tagline()}
                          </p>
                          <p className='text-sm text-text-primary'>{details.tagline}</p>
                        </div>
                      )}
                      {details.category && (
                        <div>
                          <p className='text-xs text-text-muted'>
                            {m.admin_shops_application_field_category()}
                          </p>
                          <Badge variant='secondary' className='mt-0.5'>
                            {details.category}
                          </Badge>
                        </div>
                      )}
                      {details.tags.length > 0 && (
                        <div>
                          <p className='text-xs text-text-muted'>
                            {m.admin_shops_application_field_tags()}
                          </p>
                          <div className='flex flex-wrap gap-1 mt-1'>
                            {details.tags.map((t: string) => (
                              <Badge key={t} variant='outline'>
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Story */}
                  <div className='space-y-2'>
                    <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
                      {m.admin_shops_application_section_story()}
                    </h3>
                    <div className='bg-surface-inset rounded-xl p-4 space-y-3 border border-border-subtle'>
                      <div>
                        <p className='text-xs text-text-muted'>
                          {m.admin_shops_application_field_desc()}
                        </p>
                        <p className='text-sm text-text-primary whitespace-pre-wrap leading-relaxed max-w-[65ch] mt-0.5'>
                          {details.description || '—'}
                        </p>
                      </div>
                      {details.languages.length > 0 && (
                        <div>
                          <p className='text-xs text-text-muted'>Languages</p>
                          <p className='text-sm text-text-primary mt-0.5'>
                            {details.languages.join(', ')}
                          </p>
                        </div>
                      )}
                      {details.socials && details.socials.length > 0 && (
                        <div>
                          <p className='text-xs text-text-muted'>
                            {m.admin_shops_application_field_socials()}
                          </p>
                          <div className='flex flex-col gap-1.5 mt-1'>
                            {details.socials.map(
                              (s: { id: string; platform: string; url: string }) => (
                                <a
                                  key={s.id}
                                  href={s.url}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='text-xs text-accent-primary hover:underline flex items-center gap-1 w-fit'
                                >
                                  <Globe size={12} className='text-text-muted' />
                                  <span className='font-mono'>
                                    {s.platform}: {s.url}
                                  </span>
                                  <ExternalLink size={10} />
                                </a>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Visuals */}
                  <div className='space-y-2'>
                    <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
                      {m.admin_shops_application_section_visuals()}
                    </h3>
                    <div className='bg-surface-inset rounded-xl p-4 space-y-4 border border-border-subtle'>
                      <div className='flex gap-4 items-center'>
                        {details.image ? (
                          <div className='size-16 rounded-full overflow-hidden border border-border-default bg-surface-default flex-shrink-0 shadow-sm'>
                            <img
                              src={details.image}
                              alt='Logo'
                              className='w-full h-full object-cover'
                            />
                          </div>
                        ) : (
                          <div className='size-16 rounded-full bg-surface-default border border-border-subtle flex items-center justify-center text-text-muted text-xs flex-shrink-0'>
                            No Logo
                          </div>
                        )}
                        <div>
                          <p className='text-xs text-text-muted'>Shop Logo / Avatar</p>
                          <p className='text-xs text-text-secondary'>
                            Displayed on public profiles.
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className='text-xs text-text-muted mb-1.5'>Banner Image</p>
                        {details.bannerImage ? (
                          <div className='h-32 w-full rounded-lg overflow-hidden border border-border-default bg-surface-default shadow-sm'>
                            <img
                              src={details.bannerImage}
                              alt='Banner'
                              className='w-full h-full object-cover'
                            />
                          </div>
                        ) : (
                          <div className='h-20 w-full rounded-lg bg-surface-default border border-border-subtle flex items-center justify-center text-text-muted text-sm shadow-inner'>
                            No Banner Image
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Policies */}
                  <div className='space-y-2'>
                    <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
                      {m.admin_shops_application_section_policies()}
                    </h3>
                    <div className='bg-surface-inset rounded-xl p-4 space-y-3 border border-border-subtle'>
                      {details.shippingOrigin && (
                        <div>
                          <p className='text-xs text-text-muted'>
                            {m.admin_shops_application_field_shipping()}
                          </p>
                          <p className='text-sm font-semibold text-text-primary mt-0.5'>
                            {[
                              details.shippingOrigin.city,
                              details.shippingOrigin.state,
                              details.shippingOrigin.country,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                            {details.shippingOrigin.postalCode &&
                              ` (${details.shippingOrigin.postalCode})`}
                          </p>
                          <p className='text-xs text-text-secondary mt-1'>
                            Processing time:{' '}
                            <span className='font-mono'>
                              {details.shippingOrigin.processingTimeDays?.min}–
                              {details.shippingOrigin.processingTimeDays?.max}
                            </span>{' '}
                            days
                            {details.shippingOrigin.shipsInternational
                              ? ' (Ships Internationally)'
                              : ' (Domestic shipping only)'}
                          </p>
                        </div>
                      )}
                      {details.policies && (
                        <div className='pt-2 border-t border-border-subtle/50 space-y-2'>
                          <p className='text-xs text-text-muted'>
                            {m.admin_shops_application_field_policies()}
                          </p>
                          <div className='text-sm text-text-primary space-y-2'>
                            <div>
                              <span className='font-semibold text-text-secondary text-xs block'>
                                Returns
                              </span>
                              {details.policies.returns?.accepted
                                ? `Accepted within ${details.policies.returns.windowDays} days`
                                : 'Not accepted'}
                              {details.policies.returns?.conditions && (
                                <p className='text-xs text-text-secondary bg-surface-default p-2 rounded border border-border-subtle mt-1 italic'>
                                  "{details.policies.returns.conditions}"
                                </p>
                              )}
                            </div>
                            <div>
                              <span className='font-semibold text-text-secondary text-xs block'>
                                Exchanges
                              </span>
                              {details.policies.exchanges?.accepted ? 'Accepted' : 'Not accepted'}
                              {details.policies.exchanges?.conditions && (
                                <p className='text-xs text-text-secondary bg-surface-default p-2 rounded border border-border-subtle mt-1 italic'>
                                  "{details.policies.exchanges.conditions}"
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product Listing */}
                  <div className='space-y-2'>
                    <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
                      {m.admin_shops_application_section_product()}
                    </h3>
                    <div className='bg-surface-inset rounded-xl p-4 border border-border-subtle'>
                      {listings && listings.length > 0 ? (
                        listings.map((listing) => (
                          <div key={listing.id} className='space-y-3'>
                            <div className='flex gap-4 items-start'>
                              {listing.imageCount > 0 ? (
                                <div className='size-20 rounded-lg overflow-hidden border border-border-default bg-surface-default flex-shrink-0 shadow-sm'>
                                  <img
                                    src={listing.thumbnailUrl || '/placeholder.png'}
                                    alt={listing.name}
                                    className='w-full h-full object-cover'
                                  />
                                </div>
                              ) : (
                                <div className='size-20 rounded-lg bg-surface-default border border-border-subtle flex items-center justify-center text-text-muted text-xs flex-shrink-0'>
                                  No Image
                                </div>
                              )}
                              <div className='flex-1 min-w-0'>
                                <p className='font-semibold text-text-primary'>{listing.name}</p>
                                <p className='text-xs text-text-secondary mt-1 line-clamp-2'>
                                  {listing.description || 'No description'}
                                </p>
                                <div className='flex gap-4 mt-2 text-xs'>
                                  <span className='text-text-muted'>
                                    {m.admin_shops_application_field_price()}:{' '}
                                    <span className='font-mono font-semibold text-text-primary'>
                                      {formatPrice(listing.priceCents)}
                                    </span>
                                  </span>
                                  <span className='text-text-muted'>
                                    {m.admin_shops_application_field_stock()}:{' '}
                                    <span className='font-mono font-semibold text-text-primary'>
                                      {listing.stockCount}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className='text-sm text-text-muted'>
                          {m.admin_shops_application_no_listings()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions sidebar */}
                <div className='md:col-span-1'>
                  <div className='sticky top-4 space-y-4'>
                    <div className='bg-surface-inset rounded-xl p-4 border border-border-subtle space-y-3'>
                      <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
                        Review Decision
                      </h3>
                      <Button
                        variant='primary'
                        className='w-full'
                        onClick={() => handleAction('approve')}
                        isLoading={isProcessing && actionType === 'approve'}
                        disabled={isProcessing}
                      >
                        <CheckCircle size={16} className='mr-1.5' />
                        {m.admin_shops_review_approve()}
                      </Button>
                      <Button
                        variant='secondary'
                        className='w-full'
                        onClick={() => handleAction('request_changes')}
                        isLoading={isProcessing && actionType === 'request_changes'}
                        disabled={isProcessing}
                      >
                        {m.admin_shops_review_request_changes()}
                      </Button>
                      <Button
                        variant='danger'
                        className='w-full'
                        onClick={() => handleAction('reject')}
                        isLoading={isProcessing && actionType === 'reject'}
                        disabled={isProcessing}
                      >
                        {m.admin_shops_review_reject()}
                      </Button>
                    </div>

                    <div>
                      <label
                        htmlFor='review-note'
                        className='mb-1.5 block text-xs font-semibold text-text-secondary'
                      >
                        {m.admin_shops_review_note_label()}
                      </label>
                      <textarea
                        id='review-note'
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={4}
                        maxLength={2000}
                        className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                        placeholder={m.admin_shops_review_note_placeholder()}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
