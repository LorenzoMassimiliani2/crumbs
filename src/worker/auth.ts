const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const CLOCK_SKEW_SECONDS = 60
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])

export interface GoogleJwk extends JsonWebKey {
  kid?: string
}

export interface GoogleJwks {
  keys: GoogleJwk[]
}

export interface GoogleClaims {
  sub: string
  email: string
  name?: string
  picture?: string
  exp: number
  iat: number
}

export interface VerifyOptions {
  clientId: string
  allowedEmail: string
  now?: number
  loadJwks?: (force: boolean) => Promise<GoogleJwks>
}

const decoder = new TextDecoder()

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function decodeJson(value: string): unknown {
  return JSON.parse(decoder.decode(decodeBase64Url(value)))
}

const JWKS_CACHE_NAME = 'google-jwks'
const JWKS_CACHE_KEY = 'https://crumbs.internal/google-jwks'
const JWKS_CACHE_SECONDS = 3600

export async function loadGoogleJwks(force = false): Promise<GoogleJwks> {
  const cache = await caches.open(JWKS_CACHE_NAME)
  if (!force) {
    const cached = await cache.match(JWKS_CACHE_KEY)
    if (cached) return (await cached.json()) as GoogleJwks
  }

  const response = await fetch(JWKS_URL)
  if (!response.ok) {
    throw new Error(`google jwks request failed: ${response.status}`)
  }

  const body = await response.text()
  await cache.put(
    JWKS_CACHE_KEY,
    new Response(body, {
      headers: {
        'content-type': 'application/json',
        'cache-control': `max-age=${JWKS_CACHE_SECONDS}`,
      },
    }),
  )
  return JSON.parse(body) as GoogleJwks
}

export async function verifyGoogleIdToken(
  token: string,
  options: VerifyOptions,
): Promise<GoogleClaims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [rawHeader, rawPayload, rawSignature] = parts
  let header: { alg?: string; kid?: string }
  let payload: Record<string, unknown>
  try {
    header = decodeJson(rawHeader) as { alg?: string; kid?: string }
    payload = decodeJson(rawPayload) as Record<string, unknown>
  } catch {
    return null
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null

  const loadJwks = options.loadJwks ?? loadGoogleJwks
  let jwks: GoogleJwks
  try {
    jwks = await loadJwks(false)
  } catch {
    return null
  }

  let jwk = jwks.keys.find((key) => key.kid === header.kid)
  if (!jwk) {
    try {
      jwks = await loadJwks(true)
    } catch {
      return null
    }
    jwk = jwks.keys.find((key) => key.kid === header.kid)
  }
  if (!jwk) return null

  let signatureValid = false
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    signatureValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(rawSignature),
      new TextEncoder().encode(`${rawHeader}.${rawPayload}`),
    )
  } catch {
    return null
  }
  if (!signatureValid) return null

  const now = options.now ?? Math.floor(Date.now() / 1000)
  const exp = payload.exp
  const iat = payload.iat
  const issuer = payload.iss
  const audience = payload.aud
  const email = payload.email
  const emailVerified = payload.email_verified
  const subject = payload.sub

  if (typeof exp !== 'number' || now >= exp + CLOCK_SKEW_SECONDS) return null
  if (typeof iat !== 'number' || iat > now + CLOCK_SKEW_SECONDS) return null
  if (typeof issuer !== 'string' || !ISSUERS.has(issuer)) return null

  const audiences = Array.isArray(audience) ? audience : [audience]
  if (!audiences.includes(options.clientId)) return null

  if (emailVerified !== true) return null
  if (typeof email !== 'string' || email.toLowerCase() !== options.allowedEmail.toLowerCase()) {
    return null
  }
  if (typeof subject !== 'string' || subject.length === 0) return null

  return {
    sub: subject,
    email,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    exp,
    iat,
  }
}
