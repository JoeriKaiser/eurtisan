import { useRouter } from '@tanstack/react-router'
import type { CreatorShopDetail } from '#/lib/creator-dashboard'
import { ShopSettingsForm } from './shop/ShopSettingsForm'
import { ShopSettingsNoShopState } from './shop/ShopSettingsNoShopState'
import { ShopSettingsNotFoundState } from './shop/ShopSettingsNotFoundState'

export interface CreatorShopSettingsPageProps {
  shop: CreatorShopDetail | null
  allShops: Array<{ id: string; name: string }>
}

export { CreatorShopSettingsLoading } from './shop/CreatorShopSettingsLoading'
export { CreatorShopSettingsError } from './shop/CreatorShopSettingsError'

export function CreatorShopSettingsPage({ shop, allShops }: CreatorShopSettingsPageProps) {
  const router = useRouter()

  if (!shop && allShops.length === 0) {
    return <ShopSettingsNoShopState />
  }

  if (!shop) {
    return <ShopSettingsNotFoundState />
  }

  return (
    <ShopSettingsForm
      key={shop.id}
      initialShop={shop}
      allShops={allShops}
      onShopChanged={() => router.invalidate()}
    />
  )
}
