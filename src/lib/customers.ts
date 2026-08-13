import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from './auth-middleware'
import { requirePrivileged2FA } from './server-auth'
import type { SafeUser } from './server-auth'
import {
  addCustomerNoteSchema,
  addCustomerTagSchema,
  deleteCustomerNoteSchema,
  exportCustomerDataSchema,
  getCustomerDetailSchema,
  listCustomersSchema,
  removeCustomerTagSchema,
  updateCustomerNoteSchema,
} from './customers/schemas'

export {
  addCustomerNoteSchema,
  addCustomerTagSchema,
  deleteCustomerNoteSchema,
  exportCustomerDataSchema,
  getCustomerDetailSchema,
  listCustomersSchema,
  removeCustomerTagSchema,
  updateCustomerNoteSchema,
} from './customers/schemas'

export type {
  ShopCustomerListItem,
  ShopCustomerDetail,
  CustomerOrderSummary,
  CustomerNoteDetail,
  CustomerDataExport,
  ShopCustomersResult,
} from './customers.server'

export const listShopCustomers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listCustomersSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { listShopCustomers: query } = await import('./customers.server')
    return query(data.shopId, {
      page: data.page,
      pageSize: data.pageSize,
      search: data.search,
    })
  })

export const getShopCustomerDetail = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(getCustomerDetailSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { getShopCustomerDetail: query } = await import('./customers.server')
    const detail = await query(data.shopId, data.customerEmailHash)
    if (!detail) {
      throw new Error('NOT_FOUND')
    }
    return detail
  })

export const addCustomerNote = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(addCustomerNoteSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { addCustomerNote: query } = await import('./customers.server')
    return query(data.shopId, data.customerEmailHash, data.content, {
      id: context.user.id,
      name: context.user.name,
    })
  })

export const updateCustomerNote = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateCustomerNoteSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { updateCustomerNote: query } = await import('./customers.server')
    return query(data.noteId, data.content, { id: context.user.id, name: context.user.name })
  })

export const deleteCustomerNote = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(deleteCustomerNoteSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    requirePrivileged2FA(context.user as SafeUser)

    const { deleteCustomerNote: query } = await import('./customers.server')
    await query(data.noteId, { id: context.user.id, name: context.user.name })
  })

export const addCustomerTag = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(addCustomerTagSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { addCustomerTag: query } = await import('./customers.server')
    return query(data.shopId, data.customerEmailHash, data.tag, {
      id: context.user.id,
      name: context.user.name,
    })
  })

export const removeCustomerTag = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(removeCustomerTagSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { removeCustomerTag: query } = await import('./customers.server')
    await query(data.shopId, data.customerEmailHash, data.tag, {
      id: context.user.id,
      name: context.user.name,
    })
  })

export const exportCustomerData = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(exportCustomerDataSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { requireRoleForUser, requireShopOwnershipForUser } = await import('./authz')
    requireRoleForUser('creator', context.user)
    await requireShopOwnershipForUser(context.user, data.shopId)
    requirePrivileged2FA(context.user as SafeUser)

    const { exportCustomerData: query } = await import('./customers.server')
    return query(data.shopId, data.customerEmailHash)
  })
