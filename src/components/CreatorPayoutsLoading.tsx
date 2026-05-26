import { Skeleton } from '#/components/ui/skeleton'
import { Card, CardHeader, CardContent } from '#/components/ui/card'

export function CreatorPayoutsLoading() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-2 h-9 w-48' />
        <Skeleton className='mb-6 h-4 w-72' />

        <Skeleton className='mb-6 h-10 w-full sm:w-64' />

        {/* Summary card skeletons */}
        <div className='mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-4 w-24' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-24' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-4 w-24' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-24' />
            </CardContent>
          </Card>
        </div>

        {/* Filter tabs skeleton */}
        <Skeleton className='mb-6 h-10 w-80' />

        {/* Table skeleton */}
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm' aria-hidden='true'>
            <thead>
              <tr className='border-b border-border-default'>
                <th className='pb-3 pr-4'>
                  <Skeleton className='h-4 w-20' />
                </th>
                <th className='pb-3 pr-4'>
                  <Skeleton className='h-4 w-16' />
                </th>
                <th className='pb-3 pr-4'>
                  <Skeleton className='h-4 w-16 ml-auto' />
                </th>
                <th className='pb-3'>
                  <Skeleton className='h-4 w-20' />
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
                <tr key={i} className='border-b border-border-subtle'>
                  <td className='py-3 pr-4'>
                    <Skeleton className='h-4 w-20 font-mono' />
                  </td>
                  <td className='py-3 pr-4'>
                    <Skeleton className='h-4 w-24' />
                  </td>
                  <td className='py-3 pr-4'>
                    <Skeleton className='h-4 w-16 ml-auto' />
                  </td>
                  <td className='py-3'>
                    <Skeleton className='h-5 w-20 rounded-full' />
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
