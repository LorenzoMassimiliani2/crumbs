import { describe, expect, it } from 'vitest'

import { parseCredential, serializeCredential } from './credential'

describe('parseCredential', () => {
  it('accepts a stored google credential', () => {
    const raw = JSON.stringify({ token: 'jwt', kind: 'google', expiresAt: 123 })
    expect(parseCredential(raw)).toEqual({ token: 'jwt', expiresAt: 123 })
  })

  it('round-trips a serialized credential', () => {
    const credential = { token: 'jwt', expiresAt: 123 }
    expect(parseCredential(serializeCredential(credential))).toEqual(credential)
  })

  it('rejects non-google credentials', () => {
    const raw = JSON.stringify({ token: 'static', kind: 'service', expiresAt: 123 })
    expect(parseCredential(raw)).toBeNull()
  })

  it('rejects a credential without a numeric expiry', () => {
    expect(parseCredential(JSON.stringify({ token: 'jwt', kind: 'google' }))).toBeNull()
    expect(
      parseCredential(JSON.stringify({ token: 'jwt', kind: 'google', expiresAt: '123' })),
    ).toBeNull()
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
