export {
  clearProductsIndex,
  configureProductsIndex,
  isMeilisearchHealthy,
  MAX_TOTAL_HITS,
  populateProductsIndex,
  processMeilisearchSyncQueue,
  PRODUCTS_INDEX,
  rebuildProductsIndex,
  removeProductFromMeilisearch,
  removeShopProductsFromMeilisearch,
  searchProductsMeilisearch,
  syncProductToMeilisearch,
} from './products/meilisearch.server'
export type { MeilisearchProductDocument } from './products/meilisearch.server'
