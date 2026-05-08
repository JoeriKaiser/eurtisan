import { createFileRoute, notFound } from '@tanstack/react-router'
import { getCategoryBySlugQuery } from '#/lib/categories'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/category/$slug')({
  loader: async ({ params }) => {
    const category = await getCategoryBySlugQuery(params.slug)

    if (!category) {
      throw notFound()
    }

    return { category }
  },
  component: CategoryPage,
})

function CategoryPage() {
  const { category } = Route.useLoaderData()

  return (
    <main className='page-wrap px-4 pb-8 pt-14'>
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <p className='island-kicker mb-3'>{m.category_kicker()}</p>
        <h1 className='display-title mb-5 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl'>
          {category.name}
        </h1>
        <p className='m-0 max-w-2xl text-base text-[var(--sea-ink-soft)]'>
          {m.category_description({ name: category.name })}
        </p>
      </section>
    </main>
  )
}
