export interface CategoryTreeNode {
  id: string
  name: string
  slug: string
  parentId: string | null
  createdAt?: Date | null
  description?: string | null
  children: CategoryTreeNode[]
}

export function buildCategoryTree(
  flatCategories: {
    id: string
    name: string
    slug: string
    parentId: string | null
    createdAt?: Date | null
    description?: string | null
  }[],
): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>()

  for (const cat of flatCategories) {
    map.set(cat.id, {
      ...cat,
      createdAt: cat.createdAt ?? null,
      description: cat.description ?? null,
      children: [],
    })
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

function collectSubtreeSlugs(node: CategoryTreeNode, out: string[]): void {
  out.push(node.slug)
  for (const child of node.children) {
    collectSubtreeSlugs(child, out)
  }
}

function findNodeBySlug(nodes: readonly CategoryTreeNode[], slug: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.slug === slug) return node
    const found = findNodeBySlug(node.children, slug)
    if (found) return found
  }
  return null
}

/**
 * Resolve a category slug to itself plus every descendant slug beneath it in
 * the category tree. Falls back to `[slug]` when the slug is not in the tree
 * so unknown slugs still filter cleanly rather than widening the query.
 */
export function resolveDescendantCategorySlugs(
  tree: readonly CategoryTreeNode[],
  slug: string,
): string[] {
  const node = findNodeBySlug(tree, slug)
  if (!node) return [slug]
  const slugs: string[] = []
  collectSubtreeSlugs(node, slugs)
  return slugs
}

/**
 * Roll leaf category facet counts up into ancestor categories so parent
 * filters display the total matching items across their entire subtree.
 * Preserves any leaf slugs not present in the tree.
 */
export function rollupCategoryFacetCounts(
  tree: readonly CategoryTreeNode[],
  leafCounts: Readonly<Record<string, number>>,
): Record<string, number> {
  const rolled: Record<string, number> = { ...leafCounts }

  function accumulate(node: CategoryTreeNode): number {
    let total = leafCounts[node.slug] ?? 0
    for (const child of node.children) {
      total += accumulate(child)
    }
    if (total > 0 || Object.hasOwn(leafCounts, node.slug)) {
      rolled[node.slug] = total
    }
    return total
  }

  for (const root of tree) {
    accumulate(root)
  }

  return rolled
}

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
