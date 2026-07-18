import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { shop, user } from '#/db/schema'
import type { SafeUser } from '../server-auth'
import { authorizeImageUploadInternal } from './upload-authorization.server'

const actor: SafeUser = {
  id: 'customer-1',
  name: 'Customer',
  email: 'customer@example.test',
  emailVerified: true,
  image: null,
  role: 'customer',
  bannedAt: null,
  deletedAt: null,
  twoFactorEnabled: false,
}

beforeEach(async () => {
  await db.delete(shop)
  await db.delete(user)
  await db.insert(user).values([
    { id: actor.id, name: actor.name, email: actor.email, emailVerified: true, role: 'customer' },
    {
      id: 'other-customer',
      name: 'Other',
      email: 'other@example.test',
      emailVerified: true,
      role: 'customer',
    },
  ])
  await db.insert(shop).values({
    id: '11111111-1111-4111-8111-111111111111',
    name: '',
    slug: 'draft-upload-test',
    ownerId: actor.id,
    status: 'draft',
  })
})

describe('authorizeImageUploadInternal', () => {
  it('allows a customer to upload only for their active onboarding draft', async () => {
    await expect(
      authorizeImageUploadInternal(actor, '11111111-1111-4111-8111-111111111111'),
    ).resolves.toBeUndefined()
  })

  it('rejects missing, foreign, and no-longer-editable drafts', async () => {
    await expect(authorizeImageUploadInternal(actor)).rejects.toThrow('ONBOARDING_DRAFT_REQUIRED')
    await expect(
      authorizeImageUploadInternal(
        { ...actor, id: 'other-customer' },
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toThrow('ONBOARDING_DRAFT_NOT_FOUND')

    await db.update(shop).set({ status: 'pending_review' })
    await expect(
      authorizeImageUploadInternal(actor, '11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrow('ONBOARDING_DRAFT_NOT_FOUND')
  })
})
