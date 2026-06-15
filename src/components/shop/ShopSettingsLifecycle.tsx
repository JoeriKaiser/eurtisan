import { useState } from 'react'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import type { CreatorShopDetail } from '#/lib/creator-dashboard'
import {
  pauseShop,
  resumeShop,
  archiveShop,
  requestShopDeletion,
  cancelShopDeletion,
} from '#/lib/shop-lifecycle'

interface ShopSettingsLifecycleProps {
  shop: CreatorShopDetail
  onChanged: () => void
}

export function ShopSettingsLifecycle({ shop, onChanged }: ShopSettingsLifecycleProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const showError = (message: string) => {
    setError(message)
    setSuccess(false)
  }

  const showSuccess = () => {
    setError(null)
    setSuccess(true)
  }

  const handleAction = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(action)
    setError(null)
    setSuccess(false)
    try {
      await fn()
      showSuccess()
      onChanged()
    } catch (err) {
      let message = m.creator_shop_lifecycle_error() as string
      if (err instanceof Response) {
        try {
          const body = (await err.json()) as { message?: string }
          message = body.message ?? message
        } catch {
          // keep default
        }
      } else if (err instanceof Error) {
        message = err.message
      }
      showError(message)
    } finally {
      setLoading(null)
    }
  }

  const isPaused = shop.status === 'paused'
  const isArchived = shop.status === 'archived'

  return (
    <div className='rounded-xl border border-error/30 bg-error-subtle/20 p-4'>
      <h3 className='mb-1 text-sm font-semibold text-text-primary'>
        {m.creator_shop_lifecycle_title()}
      </h3>
      <p className='mb-4 text-xs text-text-muted'>{m.creator_shop_lifecycle_description()}</p>

      {success && (
        <FeedbackBanner type='success' message={m.creator_shop_lifecycle_success() as string} />
      )}
      {error && <FeedbackBanner type='error' message={error} />}

      {shop.scheduledDeleteAt ? (
        <div className='space-y-3'>
          <p className='text-sm text-text-primary'>
            {m.creator_shop_deletion_scheduled({
              date: new Date(shop.scheduledDeleteAt).toLocaleDateString(),
            })}
          </p>
          <Button
            type='button'
            variant='secondary'
            isLoading={loading === 'cancel-delete'}
            onClick={() =>
              handleAction('cancel-delete', () => cancelShopDeletion({ data: { shopId: shop.id } }))
            }
          >
            {m.creator_shop_cancel_deletion()}
          </Button>
        </div>
      ) : (
        <div className='flex flex-wrap gap-3'>
          {!isArchived && (
            <Button
              type='button'
              variant='secondary'
              isLoading={loading === 'pause'}
              onClick={() =>
                handleAction('pause', () =>
                  isPaused
                    ? resumeShop({ data: { shopId: shop.id } })
                    : pauseShop({ data: { shopId: shop.id } }),
                )
              }
            >
              {isPaused ? m.creator_shop_resume() : m.creator_shop_pause()}
            </Button>
          )}

          {!isArchived && (
            <Button
              type='button'
              variant='secondary'
              isLoading={loading === 'archive'}
              onClick={() =>
                handleAction('archive', () => archiveShop({ data: { shopId: shop.id } }))
              }
            >
              {m.creator_shop_archive()}
            </Button>
          )}

          {isArchived && (
            <Button
              type='button'
              variant='primary'
              isLoading={loading === 'delete'}
              onClick={() =>
                handleAction('delete', () => requestShopDeletion({ data: { shopId: shop.id } }))
              }
            >
              {m.creator_shop_request_deletion()}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
