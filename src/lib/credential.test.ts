import { describe, expect, it } from 'vitest'

import { parseCredential } from './credential'

describe('parseCredential', () => {
  it('accepts a stored google credential', () => {
    const raw = JSON.stringify({ token: 'jwt', kind: 'google', expiresAt: 123 })
    expect(parseCredential(raw)).toEqual({ token: 'jwt', expiresAt: 123 })
  })

  it('rejects service credentials', () => {
    const raw = JSON.stringify({ token: 'static', kind: 'service' })
    expect(parseCredential(raw)).toBeNull()
  })

  it('rejects a legacy raw token', () => {
    expect(parseCredential('static-token')).toBeNull()
  })

  it('rejects malformed values', () => {
    expect(parseCredential('{')).toBeNull()
    expect(parseCredential(JSON.stringify({ kind: 'google' }))).toBeNull()
  })

  it('rejects an absent value', () => {
    expect(parseCredential(null)).toBeNull()
  })
})
