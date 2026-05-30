import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { createShopDraft } from '#/lib/sell-onboarding'

export function CreateShopButton({ shopCount }: { shopCount: number }) {
  const handleCreate = async () => {
    if (shopCount >= 3) {
      const confirmed = window.confirm(
        "You're opening shop #4. Are you sure you want to manage multiple shops?",
      )
      if (!confirmed) return
    }
    const { id } = await createShopDraft()
    window.location.href = `/sell/onboarding/${id}`
  }

  return (
    <Button variant='primary' onClick={handleCreate}>
      <Plus size={16} className='mr-1' />
      Open a New Shop
    </Button>
  )
}
