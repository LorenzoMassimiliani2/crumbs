import type { Env } from './env'

function unauthorized(): Response {
  return Response.json(
    { error: 'unauthorized' },
    { status: 401, headers: { 'www-authenticate': 'Bearer' } },
  )
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/api/health') {
      return Response.json({ ok: true })
    }

    if (pathname.startsWith('/api/')) {
      const header = request.headers.get('authorization') ?? ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : ''
      if (!env.API_TOKEN || token !== env.API_TOKEN) {
        return unauthorized()
      }
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
