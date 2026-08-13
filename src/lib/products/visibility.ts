export type ProductStatus = 'draft' | 'published' | 'archived'

export function isProductVisible(product: { status: ProductStatus; isActive: boolean }): boolean {
  return product.status === 'published' && product.isActive
}
