import { beforeAll, describe, expect, it } from 'vitest'

import { verifyGoogleIdToken, type GoogleJwks } from './auth'

const CLIENT_ID = 'test-client.apps.googleusercontent.com'
const EMAIL = 'owner@example.com'

let privateKey: CryptoKey
let publicJwk: GoogleJwks['keys'][number]

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair

  privateKey = pair.privateKey
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  publicJwk = { ...jwk, kid: 'test-kid', alg: 'RS256', use: 'sig' }
})

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)))
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

async function makeToken(
  overrides: Record<string, unknown> = {},
  kid = 'test-kid',
): Promise<string> {
  const now = nowSeconds()
  const header = { alg: 'RS256', kid, typ: 'JWT' }
  const payload = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'user-1',
    email: EMAIL,
    email_verified: true,
    exp: now + 3600,
    iat: now - 10,
    name: 'Owner',
    ...overrides,
  }

  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${base64Url(new Uint8Array(signature))}`
}

function loader(keys: GoogleJwks['keys'], counter?: { count: number }) {
  return async (): Promise<GoogleJwks> => {
    if (counter) counter.count += 1
    return { keys }
  }
}

function verify(token: string, loadJwks: () => Promise<GoogleJwks>) {
  return verifyGoogleIdToken(token, {
    clientId: CLIENT_ID,
    allowedEmail: EMAIL,
    now: nowSeconds(),
    loadJwks,
  })
}

describe('verifyGoogleIdToken', () => {
  it('accepts a valid token and returns claims', async () => {
    const claims = await verify(await makeToken(), loader([publicJwk]))

    expect(claims).toMatchObject({
      sub: 'user-1',
      email: EMAIL,
      name: 'Owner',
    })
  })

  it('rejects a token with a different audience', async () => {
    const token = await makeToken({ aud: 'other-client' })
    expect(await verify(token, loader([publicJwk]))).toBeNull()
  })

  it('rejects a token with a different issuer', async () => {
    const token = await makeToken({ iss: 'https://evil.example.com' })
    expect(await verify(token, loader([publicJwk]))).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await makeToken({ exp: nowSeconds() - 120 })
    expect(await verify(token, loader([publicJwk]))).toBeNull()
  })

  it('rejects a token issued in the future', async () => {
    const token = await makeToken({ iat: nowSeconds() + 600 })
    expect(await verify(token, loader([publicJwk]))).toBeNull()
  })

  it('rejects an email outside the allowlist', async () => {
    const token = await makeToken({ email: 'someone@example.com' })
    expect(await verify(token, loader([publicJwk]))).toBeNull()
  })

  it('rejects an unverified email', async () => {
    const token = await makeToken({ email_verified: false })
    expect(await verify(token, loader([publicJwk]))).toBeNull()
  })

  it('rejects a token signed by another key', async () => {
    const otherPair = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair

    const saved = privateKey
    privateKey = otherPair.privateKey
    const token = await makeToken()
    privateKey = saved

    expect(await verify(token, loader([publicJwk]))).toBeNull()
  })

  it('reloads the keys once when the kid is unknown', async () => {
    const counter = { count: 0 }
    let calls = 0
    const loadJwks = async (): Promise<GoogleJwks> => {
      calls += 1
      const keys = calls === 1 ? [] : [publicJwk]
      counter.count += 1
      return { keys }
    }

    const claims = await verify(await makeToken(), loadJwks)

    expect(claims).not.toBeNull()
    expect(counter.count).toBe(2)
  })

  it('rejects a token whose kid is absent from the keys', async () => {
    expect(await verify(await makeToken(), loader([]))).toBeNull()
  })

  it('rejects a malformed token', async () => {
    expect(await verify('not-a-jwt', loader([publicJwk]))).toBeNull()
  })
})
