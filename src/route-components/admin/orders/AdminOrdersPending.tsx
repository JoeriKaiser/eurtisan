import { Skeleton } from '#/components/ui/skeleton'

export function AdminOrdersPending() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='mb-2 size-9' />
        <Skeleton className='size-5' />
      </div>

      <Skeleton className='h-10 w-full rounded-lg' />
      <div className='flex gap-3'>
        <Skeleton className='size-9 rounded-md' />
        <Skeleton className='size-9 rounded-md' />
        <Skeleton className='size-9 rounded-md' />
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b border-border-default'>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <th key={n} className='pb-3 pr-4'>
                  <Skeleton className='size-4' />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row} className='border-b border-border-subtle'>
                {[1, 2, 3, 4, 5, 6].map((col) => (
                  <td key={col} className='py-3 pr-4'>
                    <Skeleton className='size-5' />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
