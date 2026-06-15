import { useRouter, Link } from '@tanstack/react-router'
import { Download, Search, Users } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/cn'
import { generateCSV, downloadCSV } from '#/lib/csv-export'
import { formatPriceEUR } from '#/lib/pricing'
import { formatDateShort } from '#/lib/format-date'
import type { ShopCustomersResult } from '#/lib/customers'

interface ShopCustomersPageProps {
  shopId: string
  result: ShopCustomersResult
  searchQuery: string
  page: number
}

export function ShopCustomersPage({ shopId, result, searchQuery, page }: ShopCustomersPageProps) {
  const router = useRouter()
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const navigateWithSearch = useCallback(
    (nextSearch: string) => {
      router.navigate({
        to: '/studio/$shopId/customers',
        params: { shopId },
        search: nextSearch.trim() ? { page: 1, search: nextSearch.trim() } : { page: 1 },
        replace: true,
      })
    },
    [router, shopId],
  )

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => navigateWithSearch(value), 300)
  }

  const handlePageChange = (nextPage: number) => {
    router.navigate({
      to: '/studio/$shopId/customers',
      params: { shopId },
      search: localSearch.trim()
        ? { page: nextPage, search: localSearch.trim() }
        : { page: nextPage },
      replace: true,
    })
  }

  const handleExportCSV = () => {
    const rows = result.customers.map((c) => ({
      name: c.name,
      email: c.email,
      orders: String(c.orderCount),
      totalSpent: formatPriceEUR(c.totalSpentCents),
      firstOrder: formatDateShort(c.firstOrderAt),
      lastOrder: formatDateShort(c.lastOrderAt),
      tags: c.tags.join(', '),
    }))
    const csv = generateCSV(rows, [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'orders', label: 'Orders' },
      { key: 'totalSpent', label: 'Total spent' },
      { key: 'firstOrder', label: 'First order' },
      { key: 'lastOrder', label: 'Last order' },
      { key: 'tags', label: 'Tags' },
    ])
    downloadCSV(csv, `customers-${shopId}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
              {m.studio_customers_title()}
            </h1>
            <p className='text-text-secondary'>{m.studio_customers_description()}</p>
          </div>
          <Button type='button' variant='secondary' size='sm' onClick={handleExportCSV}>
            <Download size={16} aria-hidden='true' />
            {m.studio_customers_export_csv()}
          </Button>
        </div>

        <div className='relative mb-6'>
          <Search
            size={18}
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted'
            aria-hidden='true'
          />
          <Input
            type='search'
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={m.studio_customers_search_placeholder()}
            className='pl-10'
          />
        </div>

        {result.customers.length === 0 ? (
          <div className='py-12 text-center'>
            <Users size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-lg font-semibold text-text-primary'>
              {searchQuery ? m.studio_customers_no_results() : m.studio_customers_empty_title()}
            </h2>
            <p className='text-text-secondary'>
              {searchQuery
                ? m.studio_customers_no_results_description()
                : m.studio_customers_empty_description()}
            </p>
          </div>
        ) : (
          <>
            <div className='overflow-x-auto rounded-xl border border-border-subtle'>
              <table className='w-full text-left text-sm'>
                <caption className='sr-only'>{m.studio_customers_title()}</caption>
                <thead className='bg-surface-inset text-text-secondary'>
                  <tr>
                    <th className='px-4 py-3 font-medium'>{m.studio_customers_col_name()}</th>
                    <th className='px-4 py-3 font-medium'>{m.studio_customers_col_email()}</th>
                    <th className='px-4 py-3 font-medium'>{m.studio_customers_col_orders()}</th>
                    <th className='px-4 py-3 font-medium'>
                      {m.studio_customers_col_total_spent()}
                    </th>
                    <th className='px-4 py-3 font-medium'>{m.studio_customers_col_last_order()}</th>
                    <th className='px-4 py-3 font-medium'>{m.studio_customers_col_tags()}</th>
                    <th className='px-4 py-3 font-medium text-right'>
                      <span className='sr-only'>{m.studio_customers_col_actions()}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-border-subtle'>
                  {result.customers.map((customer) => (
                    <tr key={customer.emailHash} className='bg-surface-default hover:bg-bg-inset'>
                      <td className='px-4 py-3 font-medium text-text-primary'>{customer.name}</td>
                      <td className='px-4 py-3 text-text-secondary'>{customer.email}</td>
                      <td className='px-4 py-3 text-text-secondary'>{customer.orderCount}</td>
                      <td className='px-4 py-3 text-text-secondary'>
                        {formatPriceEUR(customer.totalSpentCents)}
                      </td>
                      <td className='px-4 py-3 text-text-secondary'>
                        {formatDateShort(customer.lastOrderAt)}
                      </td>
                      <td className='px-4 py-3'>
                        <div className='flex flex-wrap gap-1'>
                          {customer.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant='secondary'>
                              {tag}
                            </Badge>
                          ))}
                          {customer.tags.length > 3 && (
                            <Badge variant='secondary'>+{customer.tags.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td className='px-4 py-3 text-right'>
                        <Link
                          to='/studio/$shopId/customers/$customerHash'
                          params={{ shopId, customerHash: customer.emailHash }}
                          className={cn(
                            'inline-flex h-8 items-center justify-center rounded-lg px-3.5 text-xs font-semibold',
                            'bg-transparent text-text-secondary hover:bg-bg-inset hover:text-text-primary',
                            'transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2',
                          )}
                        >
                          {m.studio_customers_view()}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.totalPages > 1 && (
              <nav
                aria-label={m.studio_customers_pagination()}
                className='mt-6 flex items-center justify-between'
              >
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  {m.studio_customers_previous()}
                </Button>
                <span className='text-sm text-text-secondary'>
                  {m.studio_customers_page_indicator({
                    page: String(page),
                    total: String(result.totalPages),
                  })}
                </span>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= result.totalPages}
                >
                  {m.studio_customers_next()}
                </Button>
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  )
}
