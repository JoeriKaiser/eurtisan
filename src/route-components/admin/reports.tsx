import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { Ban, Check, Inbox } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { cn } from '#/lib/cn'
import { formatDateMedium } from '#/lib/format-date'
import { resolveProductReport } from '#/lib/products'
import { resolveShopReport } from '#/lib/shop-profile'
import { m } from '#/paraglide/messages'
import { ReportDecisionDialog } from './reports/ReportDecisionDialog'

type ReportContent = 'product' | 'shop'
type ReportReason = 'illegal' | 'ip' | 'fraud' | 'offensive' | 'other'

const REPORT_CONTENTS = ['product', 'shop'] as const

type ProductReportsQueue = {
  reports: Array<{
    id: string
    productId: string
    productName: string
    reason: ReportReason
    details: string | null
    reporterUserId: string
    createdAt: Date | string
  }>
  total: number
  page: number
  pageSize: number
}

type ShopReportsQueue = {
  reports: Array<{
    id: string
    shopId: string
    shopName: string
    reason: ReportReason
    details: string | null
    reporterUserId: string
    createdAt: Date | string
  }>
  total: number
  page: number
  pageSize: number
}

type AdminReportsLoaderData =
  | { content: 'product'; queue: ProductReportsQueue }
  | { content: 'shop'; queue: ShopReportsQueue }

type PendingUphold = {
  content: ReportContent
  targetId: string
}

function reasonLabel(reason: ReportReason) {
  switch (reason) {
    case 'illegal':
      return m.product_report_reason_illegal()
    case 'ip':
      return m.product_report_reason_ip()
    case 'fraud':
      return m.product_report_reason_fraud()
    case 'offensive':
      return m.product_report_reason_offensive()
    case 'other':
      return m.product_report_reason_other()
  }
}

function TableRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className='overflow-x-auto rounded-lg' aria-label={label}>
      {children}
    </section>
  )
}

function ReportActions({
  onUphold,
  onDismiss,
  disabled,
}: {
  onUphold: () => void
  onDismiss: () => void
  disabled: boolean
}) {
  return (
    <div className='flex items-center justify-end gap-2'>
      <Button variant='danger' size='sm' disabled={disabled} onClick={onUphold}>
        <Ban size={14} aria-hidden='true' />
        {m.admin_reports_uphold()}
      </Button>
      <Button variant='secondary' size='sm' disabled={disabled} onClick={onDismiss}>
        <Check size={14} aria-hidden='true' />
        {m.admin_reports_dismiss()}
      </Button>
    </div>
  )
}

function ProductReportsTable({
  data,
  busy,
  onUphold,
  onDismiss,
}: {
  data: ProductReportsQueue
  busy: boolean
  onUphold: (productId: string) => void
  onDismiss: (productId: string) => void
}) {
  return (
    <TableRegion label={m.admin_reports_content_product()}>
      <table className='w-full min-w-max text-left text-sm'>
        <thead>
          <tr className='border-b border-border-default'>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reports_target()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reports_reason()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reports_details()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reports_created_at()}
            </th>
            <th scope='col' className='pb-3 text-right font-semibold text-text-secondary'>
              {m.admin_reports_actions()}
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border-subtle'>
          {data.reports.map((report) => (
            <tr key={report.id} className='group transition-colors hover:bg-bg-inset/40'>
              <td className='max-w-44 truncate py-3 pr-4 font-medium text-text-primary'>
                {report.productName}
              </td>
              <td className='py-3 pr-4 text-text-primary'>{reasonLabel(report.reason)}</td>
              <td className='max-w-xs whitespace-pre-wrap py-3 pr-4 text-text-secondary'>
                {report.details || <span className='italic text-text-muted'>-</span>}
              </td>
              <td className='py-3 pr-4 font-mono text-xs text-text-secondary'>
                {formatDateMedium(new Date(report.createdAt))}
              </td>
              <td className='whitespace-nowrap py-3 text-right'>
                <ReportActions
                  disabled={busy}
                  onUphold={() => onUphold(report.productId)}
                  onDismiss={() => onDismiss(report.productId)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  )
}

function ShopReportsTable({
  data,
  busy,
  onUphold,
  onDismiss,
}: {
  data: ShopReportsQueue
  busy: boolean
  onUphold: (shopId: string) => void
  onDismiss: (shopId: string) => void
}) {
  return (
    <TableRegion label={m.admin_reports_content_shop()}>
      <table className='w-full min-w-max text-left text-sm'>
        <thead>
          <tr className='border-b border-border-default'>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reports_target()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reports_reason()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reports_details()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_reports_created_at()}
            </th>
            <th scope='col' className='pb-3 text-right font-semibold text-text-secondary'>
              {m.admin_reports_actions()}
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border-subtle'>
          {data.reports.map((report) => (
            <tr key={report.id} className='group transition-colors hover:bg-bg-inset/40'>
              <td className='max-w-44 truncate py-3 pr-4 font-medium text-text-primary'>
                {report.shopName}
              </td>
              <td className='py-3 pr-4 text-text-primary'>{reasonLabel(report.reason)}</td>
              <td className='max-w-xs whitespace-pre-wrap py-3 pr-4 text-text-secondary'>
                {report.details || <span className='italic text-text-muted'>-</span>}
              </td>
              <td className='py-3 pr-4 font-mono text-xs text-text-secondary'>
                {formatDateMedium(new Date(report.createdAt))}
              </td>
              <td className='whitespace-nowrap py-3 text-right'>
                <ReportActions
                  disabled={busy}
                  onUphold={() => onUphold(report.shopId)}
                  onDismiss={() => onDismiss(report.shopId)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  )
}

export function AdminReportsPage() {
  const loaderData = useLoaderData({ from: '/admin/reports' }) as AdminReportsLoaderData
  const search = useSearch({ from: '/admin/reports' })
  const queueKey = loaderData.queue.reports.map((report) => report.id).join(',')

  return (
    <AdminReportsContent
      key={`${search.content}:${search.page}:${queueKey}`}
      initialData={loaderData}
    />
  )
}

function removeResolvedTarget(
  data: AdminReportsLoaderData,
  targetId: string,
): AdminReportsLoaderData {
  if (data.content === 'product') {
    const reports = data.queue.reports.filter((report) => report.productId !== targetId)
    return {
      ...data,
      queue: {
        ...data.queue,
        reports,
        total: Math.max(0, data.queue.total - (data.queue.reports.length - reports.length)),
      },
    }
  }

  const reports = data.queue.reports.filter((report) => report.shopId !== targetId)
  return {
    ...data,
    queue: {
      ...data.queue,
      reports,
      total: Math.max(0, data.queue.total - (data.queue.reports.length - reports.length)),
    },
  }
}

function AdminReportsContent({ initialData }: { initialData: AdminReportsLoaderData }) {
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/reports' })
  const [queueData, setQueueData] = useState(initialData)
  const [pending, setPending] = useState<PendingUphold | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContentChange = useCallback(
    (content: ReportContent) => {
      navigate({
        to: '/admin/reports',
        search: { ...search, content, page: 1 },
        replace: true,
      })
    },
    [navigate, search],
  )

  const handlePageChange = useCallback(
    (page: number) => {
      navigate({
        to: '/admin/reports',
        search: { ...search, page },
        replace: true,
      })
    },
    [navigate, search],
  )

  const selectUphold = useCallback((content: ReportContent, targetId: string) => {
    setError(null)
    setPending({ content, targetId })
  }, [])

  const resolveTarget = async (
    content: ReportContent,
    targetId: string,
    restrict: boolean,
    ground: 'illegal' | 'terms',
    explanation: string,
  ) => {
    setBusy(true)
    setError(null)

    try {
      if (content === 'product') {
        await resolveProductReport({
          data: { productId: targetId, restrict, ground, explanation },
        })
      } else {
        await resolveShopReport({
          data: { shopId: targetId, restrict, ground, explanation },
        })
      }
      setQueueData((previous) => removeResolvedTarget(previous, targetId))
      setPending(null)
    } catch {
      setError(m.admin_reports_decision_error())
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmUphold = async (ground: 'illegal' | 'terms', explanation: string) => {
    if (!pending) return
    await resolveTarget(pending.content, pending.targetId, true, ground, explanation)
  }

  const handleDismiss = async (content: ReportContent, targetId: string) => {
    await resolveTarget(content, targetId, false, 'terms', m.admin_reports_dismiss_explanation())
  }

  const selectedContent = search.content ?? 'product'
  const totalPages = Math.max(1, Math.ceil(queueData.queue.total / queueData.queue.pageSize))
  const isEmpty = queueData.queue.reports.length === 0

  return (
    <div className='space-y-6'>
      <header>
        <h1 className='text-3xl font-semibold text-text-primary'>{m.admin_reports_title()}</h1>
        <p className='mt-1 text-text-secondary'>{m.admin_reports_description()}</p>
      </header>

      <fieldset className='flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-border-default bg-surface-inset p-1'>
        <legend className='sr-only'>{m.admin_reports_content_label()}</legend>
        {REPORT_CONTENTS.map((content) => {
          const selected = selectedContent === content
          return (
            <button
              key={content}
              type='button'
              aria-pressed={selected}
              onClick={() => handleContentChange(content)}
              className={cn(
                'h-11 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2',
                selected
                  ? 'bg-surface-default text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {content === 'product'
                ? m.admin_reports_content_product()
                : m.admin_reports_content_shop()}
            </button>
          )
        })}
      </fieldset>

      {error && pending === null && (
        <p className='text-sm text-error' role='alert'>
          {error}
        </p>
      )}

      <section
        id='reports-queue'
        aria-label={
          selectedContent === 'product'
            ? m.admin_reports_content_product()
            : m.admin_reports_content_shop()
        }
        aria-live='polite'
      >
        {isEmpty ? (
          <Card variant='elevated'>
            <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
              <Inbox size={40} className='mb-3 text-text-muted' aria-hidden='true' />
              <p className='text-sm text-text-secondary'>{m.admin_reports_no_reports()}</p>
            </CardContent>
          </Card>
        ) : queueData.content === 'product' ? (
          <ProductReportsTable
            data={queueData.queue}
            busy={busy}
            onUphold={(productId) => selectUphold('product', productId)}
            onDismiss={(productId) => {
              void handleDismiss('product', productId)
            }}
          />
        ) : (
          <ShopReportsTable
            data={queueData.queue}
            busy={busy}
            onUphold={(shopId) => selectUphold('shop', shopId)}
            onDismiss={(shopId) => {
              void handleDismiss('shop', shopId)
            }}
          />
        )}
      </section>

      <ReportDecisionDialog
        key={pending ? `${pending.content}:${pending.targetId}` : 'closed-decision-dialog'}
        open={pending !== null}
        content={pending?.content ?? selectedContent}
        busy={busy}
        error={error}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null)
        }}
        onConfirm={handleConfirmUphold}
      />

      {totalPages > 1 && (
        <nav
          className='mt-6 flex items-center justify-between gap-4 border-t border-border-subtle pt-4'
          aria-label={m.pagination_label()}
        >
          <Button
            variant='ghost'
            size='sm'
            onClick={() => handlePageChange((search.page ?? 1) - 1)}
            disabled={(search.page ?? 1) <= 1}
          >
            &larr; {m.pagination_previous()}
          </Button>
          <span className='text-center text-sm tabular-nums text-text-muted'>
            {m.pagination_page_of({
              page: String(search.page ?? 1),
              totalPages: String(totalPages),
            })}
          </span>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => handlePageChange((search.page ?? 1) + 1)}
            disabled={(search.page ?? 1) >= totalPages}
          >
            {m.pagination_next()} &rarr;
          </Button>
        </nav>
      )}
    </div>
  )
}
