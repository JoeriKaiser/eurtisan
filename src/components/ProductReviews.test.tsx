// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import ProductReviews from './ProductReviews'

const mocks = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null },
  getProductReviews: vi.fn(),
  reportReview: vi.fn(),
  setReviewHelpful: vi.fn(),
  createSellerReply: vi.fn(),
  updateSellerReply: vi.fn(),
  deleteSellerReply: vi.fn(),
  reportSellerReply: vi.fn(),
}))

vi.mock('#/lib/auth-hooks', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('#/lib/reviews', () => ({
  getProductReviews: mocks.getProductReviews,
  reportReview: mocks.reportReview,
  setReviewHelpful: mocks.setReviewHelpful,
  createSellerReply: mocks.createSellerReply,
  updateSellerReply: mocks.updateSellerReply,
  deleteSellerReply: mocks.deleteSellerReply,
  reportSellerReply: mocks.reportSellerReply,
}))

vi.mock('#/paraglide/messages', () => {
  // Explicit entries are the ones this file asserts on. Everything else — keys
  // reached through the report dialog and its primitives — falls back to its own
  // name, so an unrelated component adding a message cannot break these tests
  // with a TypeError.
  const explicit: Record<string, unknown> = {
    rating_out_of_five: ({ rating }: { rating: number }) => `${rating} out of 5 stars`,
    reviews_title: () => 'Reviews',
    reviews_empty_title: () => 'No reviews yet',
    reviews_empty_description: () => 'Be the first to share your experience.',
    reviews_count: ({ count }: { count: number }) => `${count} review${count === 1 ? '' : 's'}`,
    reviews_load_error: () => 'Failed to load reviews.',
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: ({ page, totalPages }: { page: string; totalPages: string }) =>
      `Page ${page} of ${totalPages}`,
    reviews_controls_label: () => 'Review sorting and filtering',
    reviews_sort_label: () => 'Sort reviews',
    reviews_sort_newest: () => 'Newest',
    reviews_sort_highest: () => 'Highest rated',
    reviews_sort_lowest: () => 'Lowest rated',
    reviews_sort_helpful: () => 'Most helpful',
    reviews_rating_filter_label: () => 'Filter by rating',
    reviews_rating_all: () => 'All ratings',
    reviews_rating_option: ({ rating }: { rating: number }) => `${rating} stars`,
    reviews_filter_empty_title: () => 'No reviews match this rating',
    review_helpful_button: () => 'Helpful',
    review_helpful_mark_label: ({ count }: { count: number }) =>
      `Mark this review as helpful. Helpful marks: ${count}.`,
    review_helpful_remove_label: ({ count }: { count: number }) =>
      `Remove your helpful mark. Helpful marks: ${count}.`,
    review_helpful_error: () => 'We could not update your helpful mark.',
    seller_reply_region_label: () => 'Official seller reply',
    seller_reply_official_label: () => 'Official seller reply',
    seller_reply_by: ({ sellerName }: { sellerName: string }) => `Reply from ${sellerName}`,
    seller_reply_edited: () => 'Edited',
    seller_reply_owner_prompt: () => 'Respond publicly to this review as the seller.',
    seller_reply_create_button: () => 'Write an official reply',
    seller_reply_create_label: () => 'Your official reply',
    seller_reply_edit_label: () => 'Edit your official reply',
    seller_reply_body_hint: ({ count }: { count: number }) => `${count} of 2,000 characters used.`,
    seller_reply_publish_button: () => 'Publish reply',
    seller_reply_save_button: () => 'Save changes',
    seller_reply_edit_button: () => 'Edit reply',
    seller_reply_delete_button: () => 'Delete reply',
    seller_reply_create_success: () => 'Your reply was published.',
    seller_reply_update_success: () => 'Your reply was updated.',
    seller_reply_delete_success: () => 'Your reply was deleted.',
    seller_reply_create_error: () => 'We could not publish your reply.',
    seller_reply_update_error: () => 'We could not update your reply.',
    seller_reply_delete_error: () => 'We could not delete your reply.',
    seller_reply_delete_title: () => 'Delete official reply?',
    seller_reply_delete_description: () => 'This permanently removes your public reply.',
    seller_reply_delete_confirm: () => 'Delete reply',
    seller_reply_report_button: () => 'Report seller reply',
    seller_reply_reported_button: () => 'Reported',
    seller_reply_report_success: () => 'Seller reply reported',
    seller_reply_report_title: () => 'Report this seller reply',
    seller_reply_report_description: () => 'A moderator reviews every reply report.',
    seller_reply_report_reason_not_authentic: () => 'I doubt this came from the seller',
    seller_reply_report_details_label: () => 'What is wrong with the reply?',
    seller_reply_report_details_placeholder: () => 'Add details.',
    seller_reply_report_submit: () => 'Send reply report',
    seller_reply_report_error: () => 'We could not send your report.',
    review_report_reason_label: () => 'Reason',
    review_report_reason_offensive: () => 'Offensive or abusive',
    review_report_reason_spam: () => 'Spam or advertising',
    review_report_reason_personal_data: () => "Contains someone's personal details",
    review_report_reason_other: () => 'Something else',
    confirm_dialog_cancel: () => 'Cancel',
    pagination_label: () => 'Pagination',
  }
  return {
    m: new Proxy(explicit, {
      get: (target, key: string) => target[key] ?? (() => key),
    }),
  }
})

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

function renderWithProviders(ui: React.ReactNode) {
  const queryClient = createTestQueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

function makeReviewsResult(
  overrides?: Partial<{
    reviews: {
      id: string
      buyerName: string
      rating: number
      comment: string | null
      createdAt: Date
      experiencedAt?: Date | null
      sellerReply?: {
        id: string
        body: string
        sellerName: string
        createdAt: Date
        updatedAt: Date
        canManage: boolean
        canReport: boolean
      } | null
      helpfulCount?: number
      viewerHasMarkedHelpful?: boolean
      canMarkHelpful?: boolean
      canReply?: boolean
    }[]
    total: number
    averageRating: number | null
    distribution: { rating: number; count: number }[]
    page: number
    pageSize: number
    totalPages: number
    sort: 'newest' | 'highest' | 'lowest' | 'helpful'
    ratingFilter: number | null
  }>,
) {
  return {
    reviews: [],
    total: 0,
    averageRating: null,
    distribution: [
      { rating: 5, count: 0 },
      { rating: 4, count: 0 },
      { rating: 3, count: 0 },
      { rating: 2, count: 0 },
      { rating: 1, count: 0 },
    ],
    page: 1,
    pageSize: 10,
    totalPages: 0,
    sort: 'newest' as const,
    ratingFilter: null,
    ...overrides,
  }
}

function makeInteractiveResult(
  reviewOverrides: Partial<
    NonNullable<NonNullable<Parameters<typeof makeReviewsResult>[0]>['reviews']>[number]
  > = {},
  resultOverrides: Parameters<typeof makeReviewsResult>[0] = {},
) {
  return makeReviewsResult({
    reviews: [
      {
        id: 'r1',
        buyerName: 'Alice',
        rating: 5,
        comment: 'Great product',
        createdAt: new Date('2024-06-15'),
        experiencedAt: null,
        sellerReply: null,
        helpfulCount: 0,
        viewerHasMarkedHelpful: false,
        canMarkHelpful: false,
        canReply: false,
        ...reviewOverrides,
      },
    ],
    total: 1,
    averageRating: 5,
    totalPages: 1,
    ...resultOverrides,
  })
}

describe('ProductReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.user = null
    mocks.reportReview.mockResolvedValue(undefined)
    mocks.setReviewHelpful.mockResolvedValue(undefined)
    mocks.createSellerReply.mockResolvedValue(undefined)
    mocks.updateSellerReply.mockResolvedValue(undefined)
    mocks.deleteSellerReply.mockResolvedValue(undefined)
    mocks.reportSellerReply.mockResolvedValue(undefined)
  })

  it('shows empty state when no reviews', async () => {
    mocks.getProductReviews.mockResolvedValue(makeReviewsResult())
    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('No reviews yet')).toBeDefined()
    })
    expect(screen.getByText('Be the first to share your experience.')).toBeDefined()
  })

  it('shows average rating and review count', async () => {
    mocks.getProductReviews.mockResolvedValue(
      makeReviewsResult({
        total: 3,
        averageRating: 4.3,
        reviews: [
          {
            id: 'r1',
            buyerName: 'Alice',
            rating: 5,
            comment: 'Great!',
            createdAt: new Date('2024-01-01'),
          },
        ],
      }),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('4.3')).toBeDefined()
    })
    expect(screen.getByText('3 reviews')).toBeDefined()
  })

  it('pluralises the review count through the message format', async () => {
    mocks.getProductReviews.mockResolvedValue(
      makeReviewsResult({
        total: 1,
        averageRating: 5,
        reviews: [
          {
            id: 'r1',
            buyerName: 'Alice',
            rating: 5,
            comment: 'Great!',
            createdAt: new Date('2024-01-01'),
          },
        ],
      }),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('1 review')).toBeDefined()
    })
  })

  it('renders review cards with buyer name, rating, comment, and date', async () => {
    mocks.getProductReviews.mockResolvedValue(
      makeReviewsResult({
        total: 1,
        averageRating: 5,
        reviews: [
          {
            id: 'r1',
            buyerName: 'Alice',
            rating: 5,
            comment: 'Amazing product!',
            createdAt: new Date('2024-06-15'),
          },
        ],
      }),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined()
    })
    expect(screen.getByText('Amazing product!')).toBeDefined()
  })

  it('renders review card without comment gracefully', async () => {
    mocks.getProductReviews.mockResolvedValue(
      makeReviewsResult({
        total: 1,
        averageRating: 4,
        reviews: [
          {
            id: 'r1',
            buyerName: 'Bob',
            rating: 4,
            comment: null,
            createdAt: new Date('2024-06-15'),
          },
        ],
      }),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeDefined()
    })
  })

  it('shows pagination when multiple pages exist', async () => {
    mocks.getProductReviews.mockResolvedValue(
      makeReviewsResult({
        total: 15,
        totalPages: 2,
        page: 1,
        reviews: Array.from({ length: 10 }, (_, i) => ({
          id: `r${i}`,
          buyerName: `User ${i}`,
          rating: 5,
          comment: 'Nice',
          createdAt: new Date(),
        })),
      }),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeDefined()
    })
    const prevButton = screen.getByRole('button', { name: /Previous/i })
    const nextButton = screen.getByRole('button', { name: /Next/i })
    expect(prevButton.hasAttribute('disabled')).toBe(true)
    expect(nextButton.hasAttribute('disabled')).toBe(false)
  })

  it('fetches next page when next button clicked', async () => {
    mocks.getProductReviews
      .mockResolvedValueOnce(
        makeReviewsResult({
          total: 15,
          totalPages: 2,
          page: 1,
          reviews: Array.from({ length: 10 }, (_, i) => ({
            id: `r${i}`,
            buyerName: `User ${i}`,
            rating: 5,
            comment: 'Nice',
            createdAt: new Date(),
          })),
        }),
      )
      .mockResolvedValueOnce(
        makeReviewsResult({
          total: 15,
          totalPages: 2,
          page: 2,
          reviews: Array.from({ length: 5 }, (_, i) => ({
            id: `r${i + 10}`,
            buyerName: `User ${i + 10}`,
            rating: 4,
            comment: 'Good',
            createdAt: new Date(),
          })),
        }),
      )

    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeDefined()
    })

    const nextButton = screen.getByRole('button', { name: /Next/i })
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 2')).toBeDefined()
    })
    expect(mocks.getProductReviews).toHaveBeenLastCalledWith({
      data: { productId: 'prod-1', page: 2, pageSize: 10, sort: 'newest' },
    })
  })

  it('shows error message when fetch fails', async () => {
    mocks.getProductReviews.mockRejectedValue(new Error('fail'))
    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load reviews.')).toBeDefined()
    })
  })

  it('does not expose internal user ids or emails', async () => {
    mocks.getProductReviews.mockResolvedValue(
      makeReviewsResult({
        total: 1,
        averageRating: 5,
        reviews: [
          {
            id: 'r1',
            buyerName: 'Alice',
            rating: 5,
            comment: 'Great!',
            createdAt: new Date(),
          },
        ],
      }),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined()
    })
    expect(screen.queryByText('user-1')).toBeNull()
    expect(screen.queryByText('alice@example.com')).toBeNull()
  })

  it('fetches reviews on mount with productId', async () => {
    mocks.getProductReviews.mockResolvedValue(makeReviewsResult())
    renderWithProviders(<ProductReviews productId='prod-abc' />)

    await waitFor(() => {
      expect(mocks.getProductReviews).toHaveBeenCalledWith({
        data: { productId: 'prod-abc', page: 1, pageSize: 10, sort: 'newest' },
      })
    })
  })

  it('resets pagination when sorting or rating filtering changes', async () => {
    mocks.getProductReviews.mockImplementation(
      ({
        data,
      }: {
        data: {
          page: number
          sort: 'newest' | 'highest' | 'lowest' | 'helpful'
          rating?: number
        }
      }) =>
        Promise.resolve(
          makeInteractiveResult(
            {},
            {
              total: 12,
              page: data.page,
              totalPages: 2,
              sort: data.sort,
              ratingFilter: data.rating ?? null,
            },
          ),
        ),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)
    await screen.findByText('Page 1 of 2')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2 of 2')
    fireEvent.change(screen.getByLabelText('Sort reviews'), { target: { value: 'highest' } })
    await waitFor(() =>
      expect(mocks.getProductReviews).toHaveBeenLastCalledWith({
        data: { productId: 'prod-1', page: 1, pageSize: 10, sort: 'highest' },
      }),
    )

    fireEvent.change(screen.getByLabelText('Filter by rating'), { target: { value: '5' } })
    await waitFor(() =>
      expect(mocks.getProductReviews).toHaveBeenLastCalledWith({
        data: { productId: 'prod-1', page: 1, pageSize: 10, sort: 'highest', rating: 5 },
      }),
    )
  })

  it('keeps the controls available when a rating filter has no matches', async () => {
    mocks.getProductReviews.mockImplementation(({ data }: { data: { rating?: number } }) =>
      Promise.resolve(
        data.rating ? makeReviewsResult({ ratingFilter: data.rating }) : makeInteractiveResult(),
      ),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)
    await screen.findByText('Great product')

    fireEvent.change(screen.getByLabelText('Filter by rating'), { target: { value: '1' } })
    await screen.findByText('No reviews match this rating')
    expect(screen.getByLabelText('Filter by rating')).toBeDefined()
  })

  it('renders the approved official seller reply supplied by the server', async () => {
    mocks.getProductReviews.mockResolvedValue(
      makeInteractiveResult({
        sellerReply: {
          id: 'reply-1',
          body: 'Thank you for your thoughtful feedback.',
          sellerName: 'Oak & Loom',
          createdAt: new Date('2024-06-16'),
          updatedAt: new Date('2024-06-17'),
          canManage: false,
          canReport: false,
        },
      }),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)

    const reply = await screen.findByRole('region', { name: 'Official seller reply' })
    expect(within(reply).getByText('Thank you for your thoughtful feedback.')).toBeDefined()
    expect(within(reply).getByText(/Reply from Oak & Loom/)).toBeDefined()
    expect(within(reply).getByText(/Edited/)).toBeDefined()
  })

  it('creates a trimmed seller reply, announces success, and recovers focus', async () => {
    mocks.auth.user = { id: 'seller-1' }
    mocks.getProductReviews.mockResolvedValue(makeInteractiveResult({ canReply: true }))
    renderWithProviders(<ProductReviews productId='prod-1' />)

    fireEvent.click(await screen.findByRole('button', { name: 'Write an official reply' }))
    fireEvent.change(screen.getByLabelText('Your official reply'), {
      target: { value: '  Thank you for your review.  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publish reply' }))

    await waitFor(() =>
      expect(mocks.createSellerReply).toHaveBeenCalledWith({
        data: { reviewId: 'r1', body: 'Thank you for your review.' },
      }),
    )
    expect((await screen.findByRole('status')).textContent).toContain('Your reply was published.')
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('region', { name: 'Official seller reply' }),
      ),
    )
  })

  it('announces a create failure without discarding the seller reply draft', async () => {
    mocks.auth.user = { id: 'seller-1' }
    mocks.getProductReviews.mockResolvedValue(makeInteractiveResult({ canReply: true }))
    mocks.createSellerReply.mockRejectedValue(new Error('failed'))
    renderWithProviders(<ProductReviews productId='prod-1' />)

    fireEvent.click(await screen.findByRole('button', { name: 'Write an official reply' }))
    fireEvent.change(screen.getByLabelText('Your official reply'), {
      target: { value: 'A reply in progress' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publish reply' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'We could not publish your reply.',
    )
    expect((screen.getByLabelText('Your official reply') as HTMLTextAreaElement).value).toBe(
      'A reply in progress',
    )
  })

  it('edits and deletes an official reply through explicit owner controls', async () => {
    mocks.auth.user = { id: 'seller-1' }
    mocks.getProductReviews.mockResolvedValue(
      makeInteractiveResult({
        sellerReply: {
          id: 'reply-1',
          body: 'Original reply',
          sellerName: 'Oak & Loom',
          createdAt: new Date('2024-06-16'),
          updatedAt: new Date('2024-06-16'),
          canManage: true,
          canReport: false,
        },
      }),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)

    fireEvent.click(await screen.findByRole('button', { name: 'Edit reply' }))
    fireEvent.change(screen.getByLabelText('Edit your official reply'), {
      target: { value: 'Updated reply' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(mocks.updateSellerReply).toHaveBeenCalledWith({
        data: { replyId: 'reply-1', body: 'Updated reply' },
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete reply' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete official reply?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete reply' }))
    await waitFor(() =>
      expect(mocks.deleteSellerReply).toHaveBeenCalledWith({
        data: { replyId: 'reply-1' },
      }),
    )
  })

  it('reports a seller reply with its dedicated copy and substantiated reason', async () => {
    mocks.auth.user = { id: 'buyer-2' }
    mocks.getProductReviews.mockResolvedValue(
      makeInteractiveResult({
        sellerReply: {
          id: 'reply-1',
          body: 'Public reply',
          sellerName: 'Oak & Loom',
          createdAt: new Date('2024-06-16'),
          updatedAt: new Date('2024-06-16'),
          canManage: false,
          canReport: true,
        },
      }),
    )
    renderWithProviders(<ProductReviews productId='prod-1' />)

    fireEvent.click(await screen.findByRole('button', { name: 'Report seller reply' }))
    expect(screen.getByRole('dialog', { name: 'Report this seller reply' })).toBeDefined()
    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }))
    fireEvent.change(screen.getByLabelText(/What is wrong with the reply\?/), {
      target: { value: '  Contains a private address  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply report' }))

    await waitFor(() =>
      expect(mocks.reportSellerReply).toHaveBeenCalledWith({
        data: {
          replyId: 'reply-1',
          reason: 'other',
          details: 'Contains a private address',
        },
      }),
    )
    expect((await screen.findByRole('status')).textContent).toContain('Seller reply reported')
  })

  it('refetches the helpful count and explicit pressed state after toggling', async () => {
    mocks.auth.user = { id: 'buyer-2' }
    mocks.getProductReviews
      .mockResolvedValueOnce(
        makeInteractiveResult({
          helpfulCount: 2,
          viewerHasMarkedHelpful: false,
          canMarkHelpful: true,
        }),
      )
      .mockResolvedValue(
        makeInteractiveResult({
          helpfulCount: 3,
          viewerHasMarkedHelpful: true,
          canMarkHelpful: true,
        }),
      )
    renderWithProviders(<ProductReviews productId='prod-1' />)

    const toggle = await screen.findByRole('button', {
      name: 'Mark this review as helpful. Helpful marks: 2.',
    })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(mocks.setReviewHelpful).toHaveBeenCalledWith({
      data: { reviewId: 'r1', helpful: true },
    })

    const pressedToggle = await screen.findByRole('button', {
      name: 'Remove your helpful mark. Helpful marks: 3.',
    })
    expect(pressedToggle.getAttribute('aria-pressed')).toBe('true')
    expect(within(pressedToggle).getByText('3')).toBeDefined()
  })

  it('announces helpful-vote failures without changing the displayed state', async () => {
    mocks.auth.user = { id: 'buyer-2' }
    mocks.getProductReviews.mockResolvedValue(
      makeInteractiveResult({
        helpfulCount: 2,
        viewerHasMarkedHelpful: false,
        canMarkHelpful: true,
      }),
    )
    mocks.setReviewHelpful.mockRejectedValue(new Error('failed'))
    renderWithProviders(<ProductReviews productId='prod-1' />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Mark this review as helpful. Helpful marks: 2.',
      }),
    )
    expect((await screen.findByRole('alert')).textContent).toContain(
      'We could not update your helpful mark.',
    )
    expect(
      screen
        .getByRole('button', { name: 'Mark this review as helpful. Helpful marks: 2.' })
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('has no axe violations for the interactive review state', async () => {
    mocks.auth.user = { id: 'buyer-2' }
    mocks.getProductReviews.mockResolvedValue(
      makeInteractiveResult({
        helpfulCount: 2,
        canMarkHelpful: true,
        sellerReply: {
          id: 'reply-1',
          body: 'Public reply',
          sellerName: 'Oak & Loom',
          createdAt: new Date('2024-06-16'),
          updatedAt: new Date('2024-06-16'),
          canManage: false,
          canReport: true,
        },
      }),
    )
    const { container } = renderWithProviders(<ProductReviews productId='prod-1' />)
    await screen.findByText('Public reply')
    expect(await axe(container)).toHaveNoViolations()
  })
})
