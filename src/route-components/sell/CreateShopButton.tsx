import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import { createShopDraft } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'

export function CreateShopButton() {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (isCreating) return
    setIsCreating(true)
    setError(null)
    try {
      const { id } = await createShopDraft()
      window.location.assign(`/sell/onboarding/${id}`)
    } catch {
      setError(m.seller_hub_create_error())
      setIsCreating(false)
    }
  }

  return (
    <div>
      <Button variant='primary' onClick={() => void handleCreate()} isLoading={isCreating}>
        <Plus size={16} aria-hidden='true' />
        {m.seller_hub_create_shop()}
      </Button>
      {error && (
        <div className='mt-3'>
          <FeedbackBanner type='error' size='sm' message={error} />
        </div>
      )}
    </div>
  )
}
