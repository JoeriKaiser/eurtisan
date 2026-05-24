import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { user } from '#/db/schema'
import { getUserDetailQuery, listUsersQuery } from './users.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      role: 'customer',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

/* -------------------------------------------------------------------------- */
/*                               listUsersQuery                               */
/* -------------------------------------------------------------------------- */

describe('listUsersQuery', () => {
  it('returns an empty users array with total 0 when there are no users', async () => {
    const result = await listUsersQuery({ page: 1, pageSize: 20 })

    expect(result).toEqual({
      users: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })
  })

  it('returns all users when count is below pageSize', async () => {
    await seedUser({ id: 'user-1', email: 'a@test.com' })
    await seedUser({ id: 'user-2', email: 'b@test.com' })
    await seedUser({ id: 'user-3', email: 'c@test.com' })

    const result = await listUsersQuery({ page: 1, pageSize: 20 })

    expect(result.users).toHaveLength(3)
    expect(result.total).toBe(3)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })

  it('respects pagination with page and pageSize', async () => {
    // Seed 5 users
    for (let i = 1; i <= 5; i++) {
      await seedUser({ id: `user-${i}`, email: `user${i}@test.com` })
    }

    const page1 = await listUsersQuery({ page: 1, pageSize: 2 })
    expect(page1.users).toHaveLength(2)
    expect(page1.total).toBe(5)
    expect(page1.page).toBe(1)

    const page2 = await listUsersQuery({ page: 2, pageSize: 2 })
    expect(page2.users).toHaveLength(2)
    expect(page2.total).toBe(5)
    expect(page2.page).toBe(2)

    const page3 = await listUsersQuery({ page: 3, pageSize: 2 })
    expect(page3.users).toHaveLength(1)
    expect(page3.total).toBe(5)
    expect(page3.page).toBe(3)

    // Verify no overlap between pages
    const page1Ids = new Set(page1.users.map((u) => u.id))
    const page2Ids = new Set(page2.users.map((u) => u.id))
    const page3Ids = new Set(page3.users.map((u) => u.id))

    for (const id of page1Ids) {
      expect(page2Ids.has(id)).toBe(false)
      expect(page3Ids.has(id)).toBe(false)
    }
    for (const id of page2Ids) {
      expect(page3Ids.has(id)).toBe(false)
    }
  })

  it('returns correct total across all pages', async () => {
    for (let i = 1; i <= 7; i++) {
      await seedUser({ id: `user-${i}`, email: `user${i}@test.com` })
    }

    const result = await listUsersQuery({ page: 1, pageSize: 3 })
    expect(result.total).toBe(7)
    expect(result.users).toHaveLength(3)
  })

  it('returns empty array for page beyond total', async () => {
    await seedUser({ id: 'user-1', email: 'a@test.com' })

    const result = await listUsersQuery({ page: 10, pageSize: 20 })
    expect(result.users).toHaveLength(0)
    expect(result.total).toBe(1)
  })

  it('filters users by name with case-insensitive search', async () => {
    await seedUser({ id: 'user-1', name: 'Alice Johnson', email: 'alice@test.com' })
    await seedUser({ id: 'user-2', name: 'Bob Smith', email: 'bob@test.com' })
    await seedUser({ id: 'user-3', name: 'Charlie Brown', email: 'charlie@test.com' })

    const result = await listUsersQuery({ query: 'alice', page: 1, pageSize: 20 })
    expect(result.users).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.users[0].name).toBe('Alice Johnson')
  })

  it('filters users by email with case-insensitive search', async () => {
    await seedUser({ id: 'user-1', name: 'Alice', email: 'alice@test.com' })
    await seedUser({ id: 'user-2', name: 'Bob', email: 'bob@test.com' })
    await seedUser({ id: 'user-3', name: 'Charlie', email: 'charlie@test.com' })

    const result = await listUsersQuery({ query: 'BOB', page: 1, pageSize: 20 })
    expect(result.users).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.users[0].email).toBe('bob@test.com')
  })

  it('matches partial name and email strings', async () => {
    await seedUser({ id: 'user-1', name: 'Alice', email: 'alice@eurtisan.eu' })
    await seedUser({ id: 'user-2', name: 'Bob', email: 'bob@other.com' })
    await seedUser({ id: 'user-3', name: 'Charlie', email: 'charlie@eurtisan.eu' })

    // "eurtisan" should match two users by email
    const result = await listUsersQuery({ query: 'eurtisan', page: 1, pageSize: 20 })
    expect(result.total).toBe(2)
    expect(result.users.map((u) => u.name).sort()).toEqual(['Alice', 'Charlie'])
  })

  it('returns empty results when no users match the query', async () => {
    await seedUser({ id: 'user-1', name: 'Alice', email: 'alice@test.com' })
    await seedUser({ id: 'user-2', name: 'Bob', email: 'bob@test.com' })

    const result = await listUsersQuery({ query: 'NoSuchUser', page: 1, pageSize: 20 })
    expect(result.users).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('returns all users when query is empty string', async () => {
    await seedUser({ id: 'user-1', email: 'a@test.com' })
    await seedUser({ id: 'user-2', email: 'b@test.com' })

    const result = await listUsersQuery({ query: '', page: 1, pageSize: 20 })
    expect(result.total).toBe(2)
  })

  it('returns all users when query is whitespace only', async () => {
    await seedUser({ id: 'user-1', email: 'a@test.com' })
    await seedUser({ id: 'user-2', email: 'b@test.com' })

    const result = await listUsersQuery({ query: '   ', page: 1, pageSize: 20 })
    expect(result.total).toBe(2)
  })

  it('returns user shape with all expected fields', async () => {
    await seedUser({
      id: 'user-1',
      name: 'Full User',
      email: 'full@test.com',
      emailVerified: true,
      image: 'https://example.com/avatar.jpg',
      role: 'creator',
    })

    const result = await listUsersQuery({ page: 1, pageSize: 20 })
    expect(result.users).toHaveLength(1)

    const u = result.users[0]
    expect(u).toHaveProperty('id')
    expect(u).toHaveProperty('name')
    expect(u).toHaveProperty('email')
    expect(u).toHaveProperty('emailVerified')
    expect(u).toHaveProperty('image')
    expect(u).toHaveProperty('role')
    expect(u).toHaveProperty('createdAt')
    expect(u).toHaveProperty('updatedAt')

    expect(u.id).toBe('user-1')
    expect(u.name).toBe('Full User')
    expect(u.email).toBe('full@test.com')
    expect(u.role).toBe('creator')
    expect(u.image).toBe('https://example.com/avatar.jpg')
    expect(u.createdAt).toBeInstanceOf(Date)
    expect(u.updatedAt).toBeInstanceOf(Date)
  })

  it('supports pagination combined with search filter', async () => {
    // Seed users with "test" in email
    for (let i = 1; i <= 5; i++) {
      await seedUser({ id: `user-${i}`, name: `Test ${i}`, email: `test${i}@eurtisan.eu` })
    }
    // Seed users that should NOT match
    await seedUser({ id: 'user-other', name: 'Other', email: 'other@example.com' })

    const result = await listUsersQuery({ query: 'eurtisan', page: 2, pageSize: 2 })
    expect(result.total).toBe(5)
    expect(result.users).toHaveLength(2)
    expect(result.page).toBe(2)
  })

  it('handles pageSize of 1 correctly', async () => {
    await seedUser({ id: 'user-1', email: 'a@test.com' })
    await seedUser({ id: 'user-2', email: 'b@test.com' })

    const result = await listUsersQuery({ page: 2, pageSize: 1 })
    expect(result.users).toHaveLength(1)
    expect(result.total).toBe(2)
  })

  it('returns consistent total across different pages', async () => {
    for (let i = 1; i <= 10; i++) {
      await seedUser({ id: `user-${i}`, email: `user${i}@test.com` })
    }

    const page1 = await listUsersQuery({ page: 1, pageSize: 3 })
    const page2 = await listUsersQuery({ page: 2, pageSize: 3 })
    const page3 = await listUsersQuery({ page: 3, pageSize: 3 })
    const page4 = await listUsersQuery({ page: 4, pageSize: 3 })

    expect(page1.total).toBe(10)
    expect(page2.total).toBe(10)
    expect(page3.total).toBe(10)
    expect(page4.total).toBe(10)
  })

  it('returns users sorted newest first (createdAt descending)', async () => {
    const now = new Date()
    await seedUser({
      id: 'user-1',
      name: 'Oldest',
      email: 'oldest@test.com',
      createdAt: new Date(now.getTime() - 30000),
      updatedAt: new Date(now.getTime() - 30000),
    })
    await seedUser({
      id: 'user-2',
      name: 'Middle',
      email: 'middle@test.com',
      createdAt: new Date(now.getTime() - 20000),
      updatedAt: new Date(now.getTime() - 20000),
    })
    await seedUser({
      id: 'user-3',
      name: 'Newest',
      email: 'newest@test.com',
      createdAt: new Date(now.getTime() - 10000),
      updatedAt: new Date(now.getTime() - 10000),
    })

    const result = await listUsersQuery({ page: 1, pageSize: 20 })

    expect(result.users).toHaveLength(3)
    expect(result.users[0].name).toBe('Newest')
    expect(result.users[1].name).toBe('Middle')
    expect(result.users[2].name).toBe('Oldest')
  })
})

/* -------------------------------------------------------------------------- */
/*                             getUserDetailQuery                             */
/* -------------------------------------------------------------------------- */

describe('getUserDetailQuery', () => {
  it('returns null when the user does not exist', async () => {
    const result = await getUserDetailQuery('nonexistent-id')
    expect(result).toBeNull()
  })

  it('returns the full user profile when found', async () => {
    await seedUser({
      id: 'user-1',
      name: 'Detail User',
      email: 'detail@test.com',
      emailVerified: true,
      image: 'https://example.com/photo.jpg',
      role: 'creator',
    })

    const result = await getUserDetailQuery('user-1')

    expect(result).not.toBeNull()
    expect(result?.id).toBe('user-1')
    expect(result?.name).toBe('Detail User')
    expect(result?.email).toBe('detail@test.com')
    expect(result?.emailVerified).toBe(true)
    expect(result?.image).toBe('https://example.com/photo.jpg')
    expect(result?.role).toBe('creator')
    expect(result?.createdAt).toBeInstanceOf(Date)
    expect(result?.updatedAt).toBeInstanceOf(Date)
  })

  it('returns null for an empty string userId', async () => {
    const result = await getUserDetailQuery('')
    expect(result).toBeNull()
  })

  it('returns the correct user when multiple users exist', async () => {
    await seedUser({ id: 'user-1', name: 'Alice', email: 'alice@test.com' })
    await seedUser({ id: 'user-2', name: 'Bob', email: 'bob@test.com' })
    await seedUser({ id: 'user-3', name: 'Charlie', email: 'charlie@test.com' })

    const result = await getUserDetailQuery('user-2')

    expect(result).not.toBeNull()
    expect(result?.id).toBe('user-2')
    expect(result?.name).toBe('Bob')
  })

  it('returns all fields including timestamps', async () => {
    await seedUser({ id: 'user-ts', name: 'TS User', email: 'ts@test.com' })

    const result = await getUserDetailQuery('user-ts')

    expect(result).not.toBeNull()
    expect(result?.createdAt).toBeInstanceOf(Date)
    expect(result?.updatedAt).toBeInstanceOf(Date)
  })

  it('returns emailVerified as false when set', async () => {
    await seedUser({
      id: 'user-unverified',
      name: 'Unverified',
      email: 'unverified@test.com',
      emailVerified: false,
    })

    const result = await getUserDetailQuery('user-unverified')

    expect(result).not.toBeNull()
    expect(result?.emailVerified).toBe(false)
  })

  it('returns image as null when not set', async () => {
    await seedUser({
      id: 'user-noimg',
      name: 'No Image',
      email: 'noimg@test.com',
      image: null,
    })

    const result = await getUserDetailQuery('user-noimg')

    expect(result).not.toBeNull()
    expect(result?.image).toBeNull()
  })
})
