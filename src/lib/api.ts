import { credential } from './auth'

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const current = credential.value
  const headers = new Headers(init.headers)
  if (current) headers.set('Authorization', `Bearer ${current.token}`)

  return fetch(path, { ...init, headers })
}
