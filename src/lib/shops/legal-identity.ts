/**
 * Seller legal identity shown at checkout and in order emails (EU trader information).
 */

export interface PostalAddress {
  street?: string
  city?: string
  postalCode?: string
  country?: string
}

export interface ShopLegalIdentity {
  tradeName: string
  contactEmail: string
  vatId: string | null
  address: PostalAddress | null
}

export function resolveShopAddress(
  businessAddress: unknown,
  shippingOrigin: unknown,
): PostalAddress | null {
  const business = businessAddress as PostalAddress | null
  if (business?.street || business?.city || business?.country) {
    return business
  }
  const origin = shippingOrigin as PostalAddress | null
  if (origin?.street || origin?.city || origin?.country) {
    return origin
  }
  return null
}

export function formatPostalAddress(address: PostalAddress | null): string | null {
  if (!address) return null
  const parts = [
    address.street,
    [address.postalCode, address.city].filter(Boolean).join(' '),
    address.country,
  ].filter((part) => part && String(part).trim().length > 0)
  return parts.length > 0 ? parts.join(', ') : null
}

export function toSellerEmailPayload(identity: ShopLegalIdentity): {
  sellerTradeName: string
  sellerContactEmail: string
  sellerAddress?: string
  sellerVatId?: string
} {
  return {
    sellerTradeName: identity.tradeName,
    sellerContactEmail: identity.contactEmail,
    sellerAddress: formatPostalAddress(identity.address) ?? undefined,
    sellerVatId: identity.vatId ?? undefined,
  }
}

export function buildShopLegalIdentity(input: {
  shopName: string
  ownerEmail: string
  vatId: string | null
  businessAddress: unknown
  shippingOrigin: unknown
}): ShopLegalIdentity {
  return {
    tradeName: input.shopName,
    contactEmail: input.ownerEmail,
    vatId: input.vatId,
    address: resolveShopAddress(input.businessAddress, input.shippingOrigin),
  }
}
