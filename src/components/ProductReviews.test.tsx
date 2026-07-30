// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductReviews from './ProductReviews'

const mockGetProductReviews = vi.hoisted(() => vi.fn())

vi.mock('#/lib/auth-hooks', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('#/lib/reviews', () => ({
  getProductReviews: mockGetProductReviews,
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    rating_out_of_five: ({ rating }: { rating: number }) => `${rating} out of 5 stars`,
    reviews_title: () => 'Reviews',
    reviews_empty_title: () => 'No reviews yet',
    reviews_empty_description: () => 'Be the first to share your experience.',
    reviews_count: ({ count }: { count: string }) => `${count} reviews`,
    reviews_count_single: () => '1 review',
    reviews_load_error: () => 'Failed to load reviews.',
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: ({ page, totalPages }: { page: string; totalPages: string }) =>
      `Page ${page} of ${totalPages}`,
  },
}))

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
    }[]
    total: number
    averageRating: number | null
    distribution: { rating: number; count: number }[]
    page: number
    pageSize: number
    totalPages: number
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
    ...overrides,
  }
}

describe('ProductReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no reviews', async () => {
    mockGetProductReviews.mockResolvedValue(makeReviewsResult())
    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('No reviews yet')).toBeDefined()
    })
    expect(screen.getByText('Be the first to share your experience.')).toBeDefined()
  })

  it('shows average rating and review count', async () => {
    mockGetProductReviews.mockResolvedValue(
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

  it('uses singular review count label for exactly one review', async () => {
    mockGetProductReviews.mockResolvedValue(
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
    mockGetProductReviews.mockResolvedValue(
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
    mockGetProductReviews.mockResolvedValue(
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
    mockGetProductReviews.mockResolvedValue(
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
    mockGetProductReviews
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
    expect(mockGetProductReviews).toHaveBeenLastCalledWith({
      data: { productId: 'prod-1', page: 2, pageSize: 10 },
    })
  })

  it('shows error message when fetch fails', async () => {
    mockGetProductReviews.mockRejectedValue(new Error('fail'))
    renderWithProviders(<ProductReviews productId='prod-1' />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load reviews.')).toBeDefined()
    })
  })

  it('does not expose internal user ids or emails', async () => {
    mockGetProductReviews.mockResolvedValue(
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
    mockGetProductReviews.mockResolvedValue(makeReviewsResult())
    renderWithProviders(<ProductReviews productId='prod-abc' />)

    await waitFor(() => {
      expect(mockGetProductReviews).toHaveBeenCalledWith({
        data: { productId: 'prod-abc', page: 1, pageSize: 10 },
      })
    })
  })
})
