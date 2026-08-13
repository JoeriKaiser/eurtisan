import { CreatorProductNewPage } from '#/components/CreatorProductNewPage'
import { useLoaderData } from '@tanstack/react-router'

export function CreatorProductNewRouteComponent() {
  const { shops, categories } = useLoaderData({ from: '/creator/products/new' })
  return <CreatorProductNewPage shops={shops} categories={categories} />
}
