import { describe, expect, it, vi } from 'vitest'
import { createImageDeliveryResponse } from './delivery.server'

const buildImgproxyUrl = vi.fn(
  (key: string, options: { width?: number; format?: string }) =>
    `https://example.test/uploads/signed/${options.width ?? 'original'}/${options.format ?? 'source'}/${key}`,
)

describe('createImageDeliveryResponse', () => {
  it('validates options and redirects to a server-signed imgproxy URL', async () => {
    const response = await createImageDeliveryResponse(
      new Request('https://example.test/api/image?key=products%2Fabc.jpg&width=400&format=webp'),
      { buildImgproxyUrl },
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe(
      'https://example.test/uploads/signed/400/webp/products/abc.jpg',
    )
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(buildImgproxyUrl).toHaveBeenCalledWith('products/abc.jpg', {
      width: 400,
      format: 'webp',
    })
  })

  it.each([
    'https://example.test/api/image?key=https%3A%2F%2Fevil.test%2Fimage.jpg',
    'https://example.test/api/image?key=products%2F..%2Fsecret.jpg',
    'https://example.test/api/image?key=products%2Fabc.jpg&width=99999',
    'https://example.test/api/image?key=products%2Fabc.svg',
  ])('rejects unsafe delivery input: %s', async (url) => {
    const response = await createImageDeliveryResponse(new Request(url), { buildImgproxyUrl })

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('fails closed when imgproxy signing is unavailable', async () => {
    await expect(
      createImageDeliveryResponse(
        new Request('https://example.test/api/image?key=products%2Fabc.jpg'),
        { buildImgproxyUrl: () => 'https://example.test/uploads/insecure/plain/image.jpg' },
      ),
    ).rejects.toThrow('requires configured imgproxy signing credentials')
  })
})
