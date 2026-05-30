import { Store } from 'lucide-react'
import { Card, CardContent } from '#/components/ui/card'
import { m } from '#/paraglide/messages'

export function EmptyShopsState() {
  return (
    <Card>
      <CardContent className='py-12 text-center'>
        <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
        <h2 className='mb-2 text-xl font-semibold text-text-primary'>
          {m.creator_no_shops_title?.() ?? 'No shops yet'}
        </h2>
        <p className='mx-auto max-w-md text-text-secondary'>
          {m.creator_no_shops_description?.() ?? 'Create your first shop to start selling.'}
        </p>
      </CardContent>
    </Card>
  )
}
