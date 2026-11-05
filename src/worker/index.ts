import { verifyGoogleIdToken, type GoogleClaims } from './auth'
import type { Env } from './env'

type AuthContext = { kind: 'service' } | { kind: 'google'; claims: GoogleClaims }

function unauthorized(): Response {
  return Response.json(
    { error: 'unauthorized' },
    { status: 401, headers: { 'www-authenticate': 'Bearer' } },
  )
}

async function authenticate(request: Request, env: Env): Promise<AuthContext | null> {
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return null

  const token = header.slice(7)
  if (env.API_TOKEN && token === env.API_TOKEN) {
    return { kind: 'service' }
  }

  if (!env.GOOGLE_CLIENT_ID || !env.ALLOWED_EMAIL) return null

  const claims = await verifyGoogleIdToken(token, {
    clientId: env.GOOGLE_CLIENT_ID,
    allowedEmail: env.ALLOWED_EMAIL,
  })

  return claims ? { kind: 'google', claims } : null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/api/health') {
      return Response.json({ ok: true })
    }

    let auth: AuthContext | null = null
    if (pathname.startsWith('/api/')) {
      auth = await authenticate(request, env)
      if (!auth) return unauthorized()
    }

    if (request.method === 'GET' && pathname === '/api/me') {
      if (auth?.kind === 'service') {
        return Response.json({ credential: 'service' })
      }
      return Response.json({
        credential: 'google',
        email: auth?.kind === 'google' ? auth.claims.email : undefined,
        name: auth?.kind === 'google' ? auth.claims.name : undefined,
        picture: auth?.kind === 'google' ? auth.claims.picture : undefined,
      })
    }

    if (request.method === 'GET' && pathname === '/api/meals') {
      const { results } = await env.DB.prepare(
        `SELECT id, date, type, note,
                created_at AS createdAt,
                updated_at AS updatedAt
         FROM meals
         WHERE deleted_at IS NULL
         ORDER BY date DESC
         LIMIT 50`,
      ).all()

      return Response.json({ meals: results })
    }

    return Response.json({ error: 'not_found' }, { status: 404 })
  },
}
