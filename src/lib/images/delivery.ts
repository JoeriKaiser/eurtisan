import z from 'zod'

export const imageDeliverySearchSchema = z.object({
  key: z
    .string()
    .max(240)
    .regex(/^(products|shops)\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|webp)$/i)
    .refine((key) => !key.includes('..'), 'Image keys cannot contain parent-directory segments'),
  width: z.coerce.number().int().min(16).max(3840).optional(),
  height: z.coerce.number().int().min(16).max(3840).optional(),
  format: z.enum(['webp', 'avif', 'jpeg', 'png']).optional(),
  quality: z.coerce.number().int().min(1).max(100).optional(),
})

export type ImageDeliveryOptions = Omit<z.infer<typeof imageDeliverySearchSchema>, 'key'>

export function buildImageDeliveryUrl(key: string, options: ImageDeliveryOptions = {}): string {
  const search = new URLSearchParams({ key })
  if (options.width !== undefined) search.set('width', String(options.width))
  if (options.height !== undefined) search.set('height', String(options.height))
  if (options.format !== undefined) search.set('format', options.format)
  if (options.quality !== undefined) search.set('quality', String(options.quality))
  return `/api/image?${search.toString()}`
}
