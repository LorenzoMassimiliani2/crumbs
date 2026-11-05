import { credential, endSession, isExpired } from './auth'

const SESSION_EXPIRED = 'Sessione scaduta. Accedi di nuovo.'

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const current = credential.value

  if (current && isExpired(current)) {
    endSession(SESSION_EXPIRED)
    return new Response(null, { status: 401, statusText: 'Unauthorized' })
  }

  const headers = new Headers(init.headers)
  if (current) headers.set('Authorization', `Bearer ${current.token}`)

  const response = await fetch(path, { ...init, headers })

  if (response.status === 401 && current) {
    endSession(SESSION_EXPIRED)
  }

  return response
}
