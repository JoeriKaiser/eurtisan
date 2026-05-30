/**
 * Client-side hook for uploading images directly to S3 via presigned URLs.
 *
 * Usage:
 *   const { upload, uploading, error } = useImageUpload()
 *   const result = await upload(file, 'products')
 *   // result.key is the S3 object key to store in the database
 *   // result.previewUrl is a direct URL for immediate preview
 */

import { useCallback, useState } from 'react'
import { getPresignedUploadUrl } from '#/lib/image-upload'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface UploadResult {
  key: string
  previewUrl: string
  imgproxyUrl: string
}

export interface UseImageUploadReturn {
  upload: (file: File, prefix: 'products' | 'shops') => Promise<UploadResult | null>
  uploadMultiple: (files: File[], prefix: 'products' | 'shops') => Promise<(UploadResult | null)[]>
  uploading: boolean
  error: string | null
  clearError: () => void
}

export function useImageUpload(): UseImageUploadReturn {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const upload = useCallback(
    async (file: File, prefix: 'products' | 'shops'): Promise<UploadResult | null> => {
      setError(null)

      if (!ALLOWED_TYPES.has(file.type)) {
        setError('Invalid file type. Allowed: JPEG, PNG, WebP.')
        return null
      }

      if (file.size > MAX_FILE_SIZE) {
        setError('File too large. Max size: 5MB.')
        return null
      }

      setUploading(true)

      try {
        const { key, uploadUrl, previewUrl, imgproxyUrl } = await getPresignedUploadUrl({
          data: { prefix, contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' },
        })

        const response = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        })

        if (!response.ok) {
          throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`)
        }

        return { key, previewUrl, imgproxyUrl }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setError(message)
        return null
      } finally {
        setUploading(false)
      }
    },
    [],
  )

  const uploadMultiple = useCallback(
    async (files: File[], prefix: 'products' | 'shops'): Promise<(UploadResult | null)[]> => {
      return Promise.all(files.map((file) => upload(file, prefix)))
    },
    [upload],
  )

  return { upload, uploadMultiple, uploading, error, clearError }
}
