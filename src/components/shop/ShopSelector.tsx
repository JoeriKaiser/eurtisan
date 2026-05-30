interface ShopSelectorProps {
  label: string
  shops: Array<{ id: string; name: string }>
  currentShopId: string
  onChange: (shopId: string) => void
}

export function ShopSelector({ label, shops, currentShopId, onChange }: ShopSelectorProps) {
  if (shops.length <= 1) return null

  return (
    <div className='mb-8'>
      <label htmlFor='shop-selector' className='mb-2 block text-sm font-medium text-text-primary'>
        {label}
      </label>
      <select
        id='shop-selector'
        value={currentShopId}
        onChange={(e) => onChange(e.target.value)}
        className='flex h-10 w-full max-w-xs rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
      >
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  )
}
