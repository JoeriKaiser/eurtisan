export interface CartProductDetail {
  id: string
  name: string
  slug: string
  priceCents: number
  stockCount: number
  imageUrl: string | null
}

export interface CartItemDetail {
  id: string
  productId: string
  quantity: number
  product: CartProductDetail | null
  unavailable: boolean
  stockWarning: boolean
}

export interface CartShopGroup {
  shopId: string | null
  shopName: string | null
  shopSlug: string | null
  shopIsVatRegistered: boolean
  items: CartItemDetail[]
  subtotalCents: number
}

export interface CartDetail {
  id: string
  userId: string | null
  sessionId: string | null
  expiresAt: Date | null
  shops: CartShopGroup[]
  totalCents: number
  totalItems: number
}
