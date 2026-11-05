export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (request.method === 'GET' && pathname === '/api/health') {
      return Response.json({ ok: true })
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
