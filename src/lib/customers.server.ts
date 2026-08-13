export type {
  CustomerDataExport,
  CustomerNoteDetail,
  CustomerOrderSummary,
  ShopCustomerDetail,
  ShopCustomerListItem,
  ShopCustomersResult,
} from './customers/operations.server'
export {
  addCustomerNote,
  addCustomerTag,
  deleteCustomerNote,
  exportCustomerData,
  getShopCustomerDetail,
  hashEmail,
  listShopCustomers,
  removeCustomerTag,
  updateCustomerNote,
} from './customers/operations.server'
