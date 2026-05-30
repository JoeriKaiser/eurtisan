import { Check } from 'lucide-react'
import type { CreatorShop } from '#/lib/creator-dashboard'
import { m } from '#/paraglide/messages'
import { Input } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'

export interface FormValues {
  shopId: string
  name: string
  slug: string
  description: string
  price: string
  stockCount: string
  categoryId: string
  isActive: boolean
  vatRateCategory: 'standard' | 'reduced' | 'exempt'
}

interface ProductNewFormFieldsProps {
  initialShops: CreatorShop[]
  categories: Array<{ id: string; name: string; slug: string }>
  values: FormValues
  fieldErrors: Record<string, string>
  slugError: string | null
  onNameChange: (value: string) => void
  onSlugChange: (value: string) => void
  onFieldChange: (field: keyof FormValues, value: string | boolean) => void
}

export function ProductNewFormFields({
  initialShops,
  categories,
  values,
  fieldErrors,
  slugError,
  onNameChange,
  onSlugChange,
  onFieldChange,
}: ProductNewFormFieldsProps) {
  return (
    <div className='space-y-5 lg:col-span-2'>
      {/* Shop selector */}
      {initialShops.length > 1 && (
        <div>
          <label
            htmlFor='product-shop'
            className='mb-2 block text-sm font-medium text-text-primary'
          >
            {m.creator_product_new_shop_label()}
          </label>
          <select
            id='product-shop'
            value={values.shopId}
            onChange={(e) => onFieldChange('shopId', e.target.value)}
            className='flex h-10 w-full max-w-xs rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
          >
            {initialShops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Product name */}
      <div>
        <label htmlFor='product-name' className='mb-2 block text-sm font-medium text-text-primary'>
          {m.creator_product_new_name_label()}
        </label>
        <Input
          id='product-name'
          type='text'
          value={values.name}
          onChange={(e) => onNameChange(e.target.value)}
          error={fieldErrors.name}
          placeholder={m.creator_product_new_name_placeholder()}
          maxLength={100}
          required
        />
        {fieldErrors.name && (
          <p id='product-name-error' className='mt-1 text-sm text-error'>
            {fieldErrors.name}
          </p>
        )}
      </div>

      {/* Slug */}
      <div>
        <label htmlFor='product-slug' className='mb-2 block text-sm font-medium text-text-primary'>
          {m.creator_product_new_slug_label()}
        </label>
        <div className='relative'>
          <Input
            id='product-slug'
            type='text'
            value={values.slug}
            onChange={(e) => onSlugChange(e.target.value)}
            error={fieldErrors.slug || slugError || undefined}
            placeholder={m.creator_product_new_slug_placeholder()}
            maxLength={100}
            required
          />
          {values.slug && !slugError && !fieldErrors.slug && (
            <span className='absolute right-3 top-1/2 -translate-y-1/2 text-success'>
              <Check size={16} aria-hidden='true' />
            </span>
          )}
        </div>
        {(fieldErrors.slug || slugError) && (
          <p id='product-slug-error' className='mt-1 text-sm text-error'>
            {fieldErrors.slug || slugError}
          </p>
        )}
        {!fieldErrors.slug && !slugError && (
          <p className='mt-1 text-xs text-text-muted'>{m.creator_product_new_slug_hint()}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor='product-description'
          className='mb-2 block text-sm font-medium text-text-primary'
        >
          {m.creator_product_new_description_label()}
        </label>
        <textarea
          id='product-description'
          rows={5}
          value={values.description}
          onChange={(e) => onFieldChange('description', e.target.value)}
          placeholder={m.creator_product_new_description_placeholder()}
          className={`w-full rounded-lg border bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 resize-y ${
            fieldErrors.description
              ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
              : 'border-border-default hover:border-border-strong focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20'
          }`}
          maxLength={2000}
        />
        <div className='mt-1 flex items-center justify-between'>
          {fieldErrors.description && (
            <p id='product-description-error' className='text-sm text-error'>
              {fieldErrors.description}
            </p>
          )}
          <p className='text-xs text-text-muted ml-auto'>{values.description.length}/2000</p>
        </div>
      </div>

      {/* Price + Stock row */}
      <div className='grid gap-5 sm:grid-cols-2'>
        {/* Price */}
        <div>
          <label
            htmlFor='product-price'
            className='mb-2 block text-sm font-medium text-text-primary'
          >
            {m.creator_product_new_price_label()}
          </label>
          <div className='relative'>
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted'>
              €
            </span>
            <Input
              id='product-price'
              type='number'
              value={values.price}
              onChange={(e) => onFieldChange('price', e.target.value)}
              error={fieldErrors.price}
              placeholder={m.creator_product_new_price_placeholder()}
              min='0'
              step='0.01'
              className='pl-7'
              required
            />
          </div>
          {fieldErrors.price && (
            <p id='product-price-error' className='mt-1 text-sm text-error'>
              {fieldErrors.price}
            </p>
          )}
        </div>

        {/* Stock */}
        <div>
          <label
            htmlFor='product-stock'
            className='mb-2 block text-sm font-medium text-text-primary'
          >
            {m.creator_product_new_stock_label()}
          </label>
          <Input
            id='product-stock'
            type='number'
            value={values.stockCount}
            onChange={(e) => onFieldChange('stockCount', e.target.value)}
            error={fieldErrors.stock}
            placeholder={m.creator_product_new_stock_placeholder()}
            min='0'
            step='1'
            required
          />
          {fieldErrors.stock && (
            <p id='product-stock-error' className='mt-1 text-sm text-error'>
              {fieldErrors.stock}
            </p>
          )}
        </div>
      </div>

      {/* Category selector */}
      <div>
        <label
          htmlFor='product-category'
          className='mb-2 block text-sm font-medium text-text-primary'
        >
          {m.creator_product_new_category_label()}
        </label>
        <select
          id='product-category'
          value={values.categoryId}
          onChange={(e) => onFieldChange('categoryId', e.target.value)}
          className={`flex h-10 w-full rounded-lg border bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 ${
            fieldErrors.categoryId
              ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
              : 'border-border-default hover:border-border-strong'
          }`}
        >
          <option value=''>{m.creator_product_new_category_none()}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {fieldErrors.categoryId && (
          <p id='product-category-error' className='mt-1 text-sm text-error'>
            {fieldErrors.categoryId}
          </p>
        )}
      </div>

      {/* VAT Rate Category */}
      <div>
        <label
          htmlFor='product-vat-category'
          className='mb-2 block text-sm font-medium text-text-primary'
        >
          VAT Rate Category
        </label>
        <select
          id='product-vat-category'
          value={values.vatRateCategory}
          onChange={(e) =>
            onFieldChange('vatRateCategory', e.target.value as 'standard' | 'reduced' | 'exempt')
          }
          className='flex h-10 w-full rounded-lg border bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 border-border-default hover:border-border-strong'
        >
          <option value='standard'>Standard Rate</option>
          <option value='reduced'>Reduced Rate</option>
          <option value='exempt'>VAT Exempt</option>
        </select>
        <p className='mt-1.5 text-xs text-text-muted'>
          Determines the tax rate applied at checkout based on destination country rules.
        </p>
      </div>

      {/* Active toggle */}
      <div className='flex items-center gap-3'>
        <Switch checked={values.isActive} onCheckedChange={(v) => onFieldChange('isActive', v)} />
        <span className='text-sm text-text-primary'>
          {values.isActive
            ? m.creator_product_new_active_label()
            : m.creator_product_new_inactive_label()}
        </span>
        {values.isActive && (
          <span className='text-xs text-text-muted'>
            {m.creator_product_new_active_description()}
          </span>
        )}
      </div>
    </div>
  )
}
