export interface Credential {
  token: string
  expiresAt: number
}

interface StoredCredential {
  token?: unknown
  kind?: unknown
  expiresAt?: unknown
}

export function parseCredential(raw: string | null): Credential | null {
  if (!raw) return null

  try {
    const value = JSON.parse(raw) as StoredCredential
    if (
      value.kind !== 'google' ||
      typeof value.token !== 'string' ||
      typeof value.expiresAt !== 'number'
    ) {
      return null
    }
    return { token: value.token, expiresAt: value.expiresAt }
  } catch {
    return null
  }
}

export function serializeCredential(value: Credential): string {
  return JSON.stringify({ token: value.token, kind: 'google', expiresAt: value.expiresAt })
}
