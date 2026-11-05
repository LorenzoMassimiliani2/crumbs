import { fetchStub } from './fetch'

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'

export interface GoogleTestIdentity {
  sign(overrides?: Record<string, unknown>): Promise<string>
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)))
}

interface CacheLike {
  match(key: string): Promise<Response | undefined>
  put(key: string, response: Response): Promise<void>
}

/**
 * Stubs the Google JWKS endpoint and the Worker cache so a signed ID token can
 * travel through the real HTTP route and the real token verification.
 */
export async function installGoogleIdentity(
  clientId: string,
  allowedEmail: string,
): Promise<GoogleTestIdentity> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 0x01]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair

  const publicJwk = {
    ...(await crypto.subtle.exportKey('jwk', pair.publicKey)),
    kid: 'test-kid',
    alg: 'RS256',
    use: 'sig',
  }
  fetchStub().intercept(JWKS_URL, () => Response.json({ keys: [publicJwk] }))

  const store = new Map<string, Response>()
  const cache: CacheLike = {
    async match(key) {
      return store.get(key)?.clone()
    },
    async put(key, response) {
      store.set(key, response.clone())
    },
  }
  ;(globalThis as Record<string, unknown>).caches = {
    open: async () => cache,
  }

  return {
    async sign(overrides = {}) {
      const now = Math.floor(Date.now() / 1000)
      const header = { alg: 'RS256', kid: 'test-kid', typ: 'JWT' }
      const payload = {
        iss: 'https://accounts.google.com',
        aud: clientId,
        sub: 'google-user-1',
        email: allowedEmail,
        email_verified: true,
        exp: now + 3600,
        iat: now - 10,
        name: 'Proprietario',
        picture: 'https://example.com/avatar.png',
        ...overrides,
      }

      const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        pair.privateKey,
        new TextEncoder().encode(signingInput),
      )
      return `${signingInput}.${base64Url(new Uint8Array(signature))}`
    },
  }
}
