export {
  clearProductsIndex,
  configureProductsIndex,
  isMeilisearchHealthy,
  markMeilisearchUnhealthy,
  MAX_TOTAL_HITS,
  populateProductsIndex,
  processMeilisearchSyncQueue,
  PRODUCTS_INDEX,
  rebuildProductsIndex,
  removeProductFromMeilisearch,
  removeShopProductsFromMeilisearch,
  resetMeilisearchHealthCacheForTests,
  searchProductsMeilisearch,
  syncProductToMeilisearch,
} from './products/meilisearch.server'
export type { MeilisearchProductDocument } from './products/meilisearch.server'
