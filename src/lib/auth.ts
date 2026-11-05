import { ref } from 'vue'

const STORAGE_KEY = 'crumbs.auth'
const LEGACY_TOKEN_KEY = 'crumbs.apiToken'
const EXPIRY_SKEW_MS = 60_000
const GIS_SRC = 'https://accounts.google.com/gsi/client'

export type CredentialKind = 'google' | 'service'

export interface Credential {
  token: string
  kind: CredentialKind
  expiresAt: number | null
}

export interface Identity {
  email?: string
  name?: string
  picture?: string
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: { credential?: string }) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signin' | 'continue_with' | 'signup_with'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      logo_alignment?: 'left' | 'center'
      width?: number
      locale?: string
    },
  ) => void
  disableAutoSelect: () => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()

export const credential = ref<Credential | null>(readCredential())
export const identity = ref<Identity | null>(null)
export const authenticated = ref(false)
export const authMessage = ref('')

function readCredential(): Credential | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const value = JSON.parse(stored) as Partial<Credential>
      if (
        typeof value.token === 'string' &&
        (value.kind === 'google' || value.kind === 'service')
      ) {
        return {
          token: value.token,
          kind: value.kind,
          expiresAt: typeof value.expiresAt === 'number' ? value.expiresAt : null,
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const legacy = localStorage.getItem(LEGACY_TOKEN_KEY)
  if (!legacy) return null

  const migrated: Credential = { token: legacy, kind: 'service', expiresAt: null }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  return migrated
}

export function saveCredential(next: Credential): void {
  credential.value = next
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  authMessage.value = ''
}

export function clearCredential(): void {
  credential.value = null
  identity.value = null
  authenticated.value = false
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

export function endSession(message = ''): void {
  clearCredential()
  authMessage.value = message
}

export function signOut(message = ''): void {
  endSession(message)
  window.google?.accounts?.id?.disableAutoSelect()
}

export function isExpired(value: Credential, now = Date.now()): boolean {
  return value.expiresAt !== null && value.expiresAt - now <= EXPIRY_SKEW_MS
}

export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = JSON.parse(atob(padded)) as unknown
    return decoded !== null && typeof decoded === 'object'
      ? (decoded as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export function decodeJwtExpiry(token: string): number | null {
  const exp = decodeJwtClaims(token)?.exp
  return typeof exp === 'number' ? exp * 1000 : null
}

let gisLoader: Promise<GoogleAccountsId> | null = null

export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (gisLoader) return gisLoader

  gisLoader = new Promise<GoogleAccountsId>((resolve, reject) => {
    const existing = window.google?.accounts?.id
    if (existing) {
      resolve(existing)
      return
    }

    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else reject(new Error('google identity unavailable'))
    }
    script.onerror = () => reject(new Error('google identity failed to load'))
    document.head.appendChild(script)
  })

  gisLoader = gisLoader.catch((error: unknown) => {
    gisLoader = null
    throw error
  })
  return gisLoader
}
