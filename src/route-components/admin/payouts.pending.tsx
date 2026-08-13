import { Skeleton } from '#/components/ui/skeleton'

export function AdminPayoutsPending() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='mb-2 size-9' />
        <Skeleton className='size-5' />
      </div>

      {/* Tabs skeleton */}
      <Skeleton className='size-10 rounded-lg' />

      {/* Table skeleton */}
      <div className='overflow-x-auto' aria-hidden='true'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b border-border-default'>
              {[1, 2, 3, 4, 5].map((n) => (
                <th key={n} className='pb-3 pr-4'>
                  <Skeleton className='size-4' />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
              <tr key={i} className='border-b border-border-subtle'>
                {[1, 2, 3, 4, 5].map((col) => (
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
