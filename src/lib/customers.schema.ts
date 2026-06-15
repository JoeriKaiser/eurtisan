import z from 'zod'

export const listCustomersSchema = z.object({
  shopId: z.string().min(1),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
})

export const getCustomerDetailSchema = z.object({
  shopId: z.string().min(1),
  customerEmailHash: z.string().min(1).max(128),
})

export const addCustomerNoteSchema = z.object({
  shopId: z.string().min(1),
  customerEmailHash: z.string().min(1).max(128),
  content: z.string().min(1).max(2000),
})

export const updateCustomerNoteSchema = z.object({
  noteId: z.string().min(1),
  content: z.string().min(1).max(2000),
})

export const deleteCustomerNoteSchema = z.object({
  noteId: z.string().min(1),
})

export const addCustomerTagSchema = z.object({
  shopId: z.string().min(1),
  customerEmailHash: z.string().min(1).max(128),
  tag: z.string().min(1).max(50),
})

export const removeCustomerTagSchema = z.object({
  shopId: z.string().min(1),
  customerEmailHash: z.string().min(1).max(128),
  tag: z.string().min(1).max(50),
})

export const exportCustomerDataSchema = z.object({
  shopId: z.string().min(1),
  customerEmailHash: z.string().min(1).max(128),
})
