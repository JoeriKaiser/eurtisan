import { Card, CardContent, CardHeader } from './ui/card'
import { Skeleton } from './ui/skeleton'

export function CreatorDashboardLoading() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-2 size-9' />
        <Skeleton className='mb-8 size-4' />

        {/* Stat skeletons */}
        <div className='mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='size-4' />
            </CardHeader>
            <CardContent>
              <Skeleton className='size-8' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='size-4' />
            </CardHeader>
            <CardContent>
              <Skeleton className='size-8' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='size-4' />
            </CardHeader>
            <CardContent>
              <Skeleton className='size-8' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='size-4' />
            </CardHeader>
            <CardContent>
              <Skeleton className='size-8' />
            </CardContent>
          </Card>
        </div>

        {/* Quick actions skeleton */}
        <Skeleton className='mb-4 size-6' />
        <div className='mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3'>
          <div className='flex flex-col items-center gap-2 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-10 rounded-full' />
            <Skeleton className='size-4' />
          </div>
          <div className='flex flex-col items-center gap-2 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-10 rounded-full' />
            <Skeleton className='size-4' />
          </div>
          <div className='flex flex-col items-center gap-2 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-10 rounded-full' />
            <Skeleton className='size-4' />
          </div>
        </div>

        {/* Activity skeleton */}
        <Skeleton className='mb-4 size-6' />
        <div className='space-y-3' aria-hidden='true'>
          <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-9 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='size-4/4' />
              <Skeleton className='size-3' />
            </div>
          </div>
          <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-9 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='size-4/4' />
              <Skeleton className='size-3' />
            </div>
          </div>
          <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-9 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='size-4/4' />
              <Skeleton className='size-3' />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
