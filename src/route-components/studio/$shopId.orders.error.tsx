export function ShopOrdersError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-5xl text-center'>
        <h1 className='display-title mb-4 text-2xl font-semibold text-text-primary'>
          Failed to load orders
        </h1>
        <p className='mb-6 text-text-secondary'>{error.message}</p>
      </div>
    </main>
  )
}
