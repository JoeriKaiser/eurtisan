/**
 * Server functions for direct-to-S3 image uploads.
 *
 * Clients request a presigned PUT URL, upload bytes directly to S3,
 * then confirm the upload to the server. The server never buffers
 * image bytes in memory.
 */

import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from '../auth-middleware'
import type { SafeUser } from '../server-auth'

const presignedUrlSchema = z.object({
  prefix: z.enum(['products', 'shops']),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  onboardingDraftId: z.string().uuid().optional(),
})

/**
 * Generates a presigned PUT URL for direct browser-to-S3 upload.
 *
 * - Authenticated users only
 * - Validates the requested prefix and content type
 * - Returns the presigned URL, the object key, and preview/display URLs
 */
export const getPresignedUploadUrl = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(presignedUrlSchema)
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('UNAUTHENTICATED')
    }

    const { authorizeImageUploadInternal } = await import('./upload-authorization.server')
    await authorizeImageUploadInternal(context.user as SafeUser, data.onboardingDraftId)

    // Dynamic import keeps this server-only module out of the browser bundle.
    const { buildImgproxyUrl, createPresignedUploadUrl, generateImageKey, ImageStorageError } =
      await import('../image-storage.server')

    const ext =
      data.contentType === 'image/jpeg' ? 'jpg' : data.contentType === 'image/png' ? 'png' : 'webp'
    const key = generateImageKey(data.prefix, ext)

    try {
      const uploadUrl = await createPresignedUploadUrl(key, data.contentType)

      return {
        key,
        uploadUrl,
        previewUrl: buildImgproxyUrl(key),
        imgproxyUrl: buildImgproxyUrl(key),
      }
    } catch (err) {
      if (err instanceof ImageStorageError) {
        throw new Error(err.message)
      }
      console.error('Failed to generate presigned URL:', err)
      throw new Error('Failed to generate upload URL')
    }
  })
