export interface Credential {
  token: string
  expiresAt: number | null
}

export function parseCredential(raw: string | null): Credential | null {
  if (!raw) return null

  try {
    const value = JSON.parse(raw) as { token?: unknown; kind?: unknown; expiresAt?: unknown }
    if (value.kind !== 'google' || typeof value.token !== 'string') return null
    return {
      token: value.token,
      expiresAt: typeof value.expiresAt === 'number' ? value.expiresAt : null,
    }
  } catch {
    return null
  }
}
