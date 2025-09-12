import { describe, it, expect } from 'vitest'
import { createSignedToken, verifyAndConsumeSignedToken } from '@/lib/signedAuth'

describe('signedAuth', () => {
  it('creates and consumes a token', async () => {
    const token = createSignedToken('00000000-0000-0000-0000-000000000000', 5)
    expect(typeof token).toBe('string')
    const userId = await verifyAndConsumeSignedToken(token)
    expect(userId).toBe('00000000-0000-0000-0000-000000000000')
    // consuming again should fail
    const again = await verifyAndConsumeSignedToken(token)
    expect(again).toBeNull()
  })
})
