import { Skeleton } from './ui/skeleton'

export function CreatorProductsLoading() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-2 size-9' />
        <Skeleton className='mb-6 size-4' />

        <Skeleton className='mb-6 h-10 w-full sm:w-64' />

        <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <Skeleton className='h-10 w-full sm:w-80' />
          <Skeleton className='size-10' />
        </div>

        {/* Skeleton table */}
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm' aria-hidden='true'>
            <thead>
              <tr className='border-b border-border-default'>
                <th className='pb-3 pr-4'>
                  <Skeleton className='size-4' />
                </th>
                <th className='pb-3 pr-4 hidden sm:table-cell'>
                  <Skeleton className='size-4' />
                </th>
                <th className='pb-3 pr-4 hidden md:table-cell'>
                  <Skeleton className='size-4' />
                </th>
                <th className='pb-3 pr-4'>
                  <Skeleton className='size-4' />
                </th>
                <th className='pb-3'>
                  <Skeleton className='size-4 ml-auto' />
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
                <tr key={i} className='border-b border-border-subtle'>
                  <td className='py-3 pr-4'>
                    <div className='flex items-center gap-3'>
                      <Skeleton className='size-10 rounded-lg' />
                      <div className='space-y-1.5'>
                        <Skeleton className='size-4' />
                        <Skeleton className='size-3 sm:hidden' />
                      </div>
                    </div>
                  </td>
                  <td className='py-3 pr-4 hidden sm:table-cell'>
                    <Skeleton className='size-4' />
                  </td>
                  <td className='py-3 pr-4 hidden md:table-cell'>
                    <Skeleton className='size-4' />
                  </td>
                  <td className='py-3 pr-4'>
                    <Skeleton className='size-5 rounded-full' />
                  </td>
                  <td className='py-3'>
                    <Skeleton className='size-8 ml-auto' />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
