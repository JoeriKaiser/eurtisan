export {
  clearProductsIndex,
  configureProductsIndex,
  isMeilisearchHealthy,
  populateProductsIndex,
  processMeilisearchSyncQueue,
  PRODUCTS_INDEX,
  removeProductFromMeilisearch,
  removeShopProductsFromMeilisearch,
  searchProductsMeilisearch,
  syncProductToMeilisearch,
} from './products/meilisearch.server'
export type { MeilisearchProductDocument } from './products/meilisearch.server'
