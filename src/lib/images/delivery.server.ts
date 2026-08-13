import { imageDeliverySearchSchema } from './delivery'

interface ImageDeliveryDependencies {
  buildImgproxyUrl: (
    key: string,
    options: {
      width?: number
      height?: number
      format?: 'webp' | 'avif' | 'jpeg' | 'png'
      quality?: number
    },
  ) => string
}

export async function createImageDeliveryResponse(
  request: Request,
  dependencies?: ImageDeliveryDependencies,
): Promise<Response> {
  const url = new URL(request.url)
  const input = Object.fromEntries(url.searchParams)
  const parsed = imageDeliverySearchSchema.safeParse(input)

  if (!parsed.success) {
    return Response.json(
      { error: 'Bad Request', message: 'Invalid image delivery parameters.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const buildImgproxyUrl =
    dependencies?.buildImgproxyUrl ?? (await import('../image-storage.server')).buildImgproxyUrl
  const { key, ...options } = parsed.data
  const location = buildImgproxyUrl(key, options)

  if (location.includes('/insecure/')) {
    throw new Error('Image delivery requires configured imgproxy signing credentials')
  }

  return new Response(null, {
    status: 307,
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      Location: location,
    },
  })
}
