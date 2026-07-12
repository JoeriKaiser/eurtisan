export interface CategoryTreeNode {
  id: string
  name: string
  slug: string
  parentId: string | null
  createdAt: Date | null
  description: string | null
  children: CategoryTreeNode[]
}

export function buildCategoryTree(
  flatCategories: {
    id: string
    name: string
    slug: string
    parentId: string | null
    createdAt: Date | null
    description: string | null
  }[],
): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>()

  for (const cat of flatCategories) {
    map.set(cat.id, { ...cat, children: [] })
  }

  const roots: CategoryTreeNode[] = []
  for (const cat of flatCategories) {
    const node = map.get(cat.id)
    if (!node) continue
    if (cat.parentId) {
      const parent = map.get(cat.parentId)
      if (parent) {
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  return roots
}

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
