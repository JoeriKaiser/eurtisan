// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getAdminReviews: vi.fn(),
  getAdminSellerReplies: vi.fn(),
  updateReviewModerationStatus: vi.fn(),
  updateSellerReplyModerationStatus: vi.fn(),
  getAdminListingReports: vi.fn(),
  resolveListingReport: vi.fn(),
  state: {
    search: {
      content: 'seller_replies' as 'reviews' | 'seller_replies' | 'listing_reports',
      status: 'flagged' as
        | 'all'
        | 'approved'
        | 'flagged'
        | 'hidden'
        | 'open'
        | 'reviewed'
        | 'actioned'
        | 'dismissed',
      page: 3,
      pageSize: 20,
    },
    loaderData: {} as unknown,
  },
}))
vi.mock('#/lib/reviews', () => ({
  getAdminReviews: mocks.getAdminReviews,
  getAdminSellerReplies: mocks.getAdminSellerReplies,
  updateReviewModerationStatus: mocks.updateReviewModerationStatus,
  updateSellerReplyModerationStatus: mocks.updateSellerReplyModerationStatus,
}))

vi.mock('#/lib/listing-reports/contract', () => ({
  getAdminListingReports: mocks.getAdminListingReports,
  resolveListingReport: mocks.resolveListingReport,
}))

// The page hooks into the router for its loader data and search params; the
// per-test shapes live in `mocks.state`, reset in `beforeEach`.
vi.mock('@tanstack/react-router', () => ({
  // The route module builds its definition at import time; only the shape
  // `Route.options` is consumed below.
  createFileRoute:
    () =>
    (options: Record<string, unknown>) =>
      ({ options }),
  useLoaderData: () => mocks.state.loaderData,
  useSearch: () => mocks.state.search,
  useNavigate: () => mocks.navigate,
}))

vi.mock('#/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_target, key: string) => (params?: Record<string, string | number>) =>
        params
          ? `${key} ${Object.entries(params)
              .map(([name, value]) => `${name}=${value}`)
              .join(' ')}`
          : key,
    },
  ),
}))

import { Route, reviewsSearchSchema } from './reviews'

const AdminReviewsPage = Route.options.component as React.ComponentType
const routeLoader = Route.options.loader as (args: {
  deps: {
    content: 'reviews' | 'seller_replies' | 'listing_reports'
    status:
      | 'all'
      | 'approved'
      | 'flagged'
      | 'hidden'
      | 'open'
      | 'reviewed'
      | 'actioned'
      | 'dismissed'
    page: number
    pageSize: number
  }
}) => Promise<unknown>

function sellerReplyQueue() {
  return {
    content: 'seller_replies' as const,
    queue: {
      sellerReplies: [
        {
          id: 'reply-1',
          reviewId: 'review-1',
          reviewRating: 4,
          reviewComment: 'The glaze is beautiful.',
          buyerName: 'Alex Buyer',
          productId: 'product-1',
          productName: 'Stoneware bowl',
          shopName: 'North Clay',
          shopSlug: 'north-clay',
          sellerName: 'Sam Seller',
          body: 'Thank you for supporting our studio.',
          moderationStatus: 'flagged' as const,
          openReports: 2,
          createdAt: new Date('2026-07-01T10:00:00Z'),
          updatedAt: new Date('2026-07-01T10:00:00Z'),
        },
      ],
      total: 41,
      page: 3,
      pageSize: 20,
      totalPages: 3,
    },
  }
}

beforeEach(() => {
  mocks.navigate.mockReset()
  mocks.getAdminReviews.mockReset().mockResolvedValue({
    reviews: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  })
  mocks.getAdminSellerReplies.mockReset().mockResolvedValue(sellerReplyQueue().queue)
  mocks.updateReviewModerationStatus.mockReset().mockResolvedValue({ success: true })
  mocks.updateSellerReplyModerationStatus.mockReset().mockResolvedValue({ success: true })
  mocks.getAdminListingReports.mockReset().mockResolvedValue({
    reports: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  })
  mocks.resolveListingReport.mockReset().mockResolvedValue({ success: true })
  mocks.state.search = {
    content: 'seller_replies',
    status: 'flagged',
    page: 3,
    pageSize: 20,
  }
  mocks.state.loaderData = sellerReplyQueue()
})

describe('admin review moderation search', () => {
  it('validates deep-linked content, status, page, and page size', () => {
    expect(
      reviewsSearchSchema.parse({
        content: 'seller_replies',
        status: 'hidden',
        page: '3',
        pageSize: '10',
      }),
    ).toEqual({ content: 'seller_replies', status: 'hidden', page: 3, pageSize: 10 })
    expect(reviewsSearchSchema.parse({})).toEqual({
      content: 'reviews',
      status: 'all',
      page: 1,
      pageSize: 20,
    })

    expect(reviewsSearchSchema.safeParse({ content: 'reports' }).success).toBe(false)
    expect(reviewsSearchSchema.safeParse({ status: 'pending' }).success).toBe(false)
    expect(reviewsSearchSchema.safeParse({ page: 0 }).success).toBe(false)
    expect(reviewsSearchSchema.safeParse({ pageSize: 101 }).success).toBe(false)
  })

  it('loads only the selected seller-reply queue', async () => {
    await routeLoader({
      deps: { content: 'seller_replies', status: 'hidden', page: 3, pageSize: 20 },
    })

    expect(mocks.getAdminSellerReplies).toHaveBeenCalledWith({
      data: { status: 'hidden', page: 3, pageSize: 20 },
    })
    expect(mocks.getAdminReviews).not.toHaveBeenCalled()
  })

  it('routes listing_reports content to the merged report queue', async () => {
    await routeLoader({
      deps: { content: 'listing_reports', status: 'actioned', page: 2, pageSize: 50 },
    })

    expect(mocks.getAdminListingReports).toHaveBeenCalledWith({
      data: { status: 'actioned', page: 2, pageSize: 50 },
    })
    expect(mocks.getAdminReviews).not.toHaveBeenCalled()
    expect(mocks.getAdminSellerReplies).not.toHaveBeenCalled()
  })

  it('maps review-moderation statuses onto "All" for the report queue', async () => {
    // The address bar is shared between queues; a stale `flagged` must not
    // reach the report queue as a silently wrong filter.
    await routeLoader({
      deps: { content: 'listing_reports', status: 'flagged', page: 1, pageSize: 20 },
    })

    expect(mocks.getAdminListingReports).toHaveBeenCalledWith({
      data: { status: 'all', page: 1, pageSize: 20 },
    })
  })

  it('maps report statuses onto "All" for the review queues', async () => {
    await routeLoader({ deps: { content: 'reviews', status: 'dismissed', page: 1, pageSize: 20 } })

    expect(mocks.getAdminReviews).toHaveBeenCalledWith({
      data: { status: 'all', page: 1, pageSize: 20 },
    })
  })
})

describe('AdminReviewsPage seller replies', () => {
  it('switches content with a page and filter reset, since the vocabularies differ', () => {
    render(<AdminReviewsPage />)

    const sellerRepliesButton = screen.getByRole('button', {
      name: 'admin_reviews_content_seller_replies',
    })
    expect(sellerRepliesButton.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'admin_reviews_content_reviews' }))

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/admin/reviews',
      search: {
        content: 'reviews',
        status: 'all',
        page: 1,
        pageSize: 20,
      },
      replace: true,
    })
  })

  it('applies every status filter to seller replies and resets the page', () => {
    render(<AdminReviewsPage />)

    for (const status of ['all', 'approved', 'flagged', 'hidden'] as const) {
      fireEvent.click(screen.getByRole('button', { name: `admin_reviews_status_${status}` }))
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        to: '/admin/reviews',
        search: {
          content: 'seller_replies',
          status,
          page: 1,
          pageSize: 20,
        },
        replace: true,
      })
    }
  })

  it('moderates a seller reply and updates the local queue after success', async () => {
    render(<AdminReviewsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'admin_reviews_action_approve' }))
    const submit = screen.getByRole('button', { name: 'admin_reviews_decision_submit' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(
      screen.getByRole('textbox', { name: /admin_reviews_decision_explanation_label/ }),
      { target: { value: 'The report was checked and the reply complies with our terms.' } },
    )
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(
      screen.getByRole('textbox', {
        name: /admin_seller_replies_decision_legal_basis_label/,
      }),
      { target: { value: 'Eurtisan Terms § 8.2' } },
    )
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(submit)

    await waitFor(() => {
      expect(mocks.updateSellerReplyModerationStatus).toHaveBeenCalledWith({
        data: {
          replyId: 'reply-1',
          status: 'approved',
          ground: 'terms',
          legalBasis: 'Eurtisan Terms § 8.2',
          explanation: 'The report was checked and the reply complies with our terms.',
        },
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'admin_reviews_action_approve' })).toBeNull()
    })
  })

  it('keeps the decision open and announces a moderation failure', async () => {
    mocks.updateSellerReplyModerationStatus.mockRejectedValueOnce(new Error('network'))
    render(<AdminReviewsPage />)

    fireEvent.click(screen.getByRole('button', { name: 'admin_reviews_action_approve' }))
    fireEvent.change(
      screen.getByRole('textbox', { name: /admin_reviews_decision_explanation_label/ }),
      { target: { value: 'This decision has an explanation.' } },
    )
    fireEvent.change(
      screen.getByRole('textbox', {
        name: /admin_seller_replies_decision_legal_basis_label/,
      }),
      { target: { value: 'Eurtisan Terms § 8.2' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'admin_reviews_decision_submit' }))

    const error = await screen.findByText('admin_seller_replies_decision_error')
    expect(error.closest('[role="alert"]')).not.toBeNull()
    expect(mocks.updateSellerReplyModerationStatus).toHaveBeenCalledTimes(1)
  })
})
