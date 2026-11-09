import { createActivity, createActivityEntry, listActivities } from './activities'
import { verifyGoogleIdToken, type GoogleClaims } from './auth'
import type { Env } from './env'
import { exportDiary } from './export'
import { createFood, deleteFood, updateFood } from './foods'
import { createMeal, deleteMeal, getDay, listFoods, updateMeal } from './meals'
import { getOffProduct, searchFoods } from './off'
import { parseProfile, profileFromRow } from './profile'

type AuthContext = { kind: 'service' } | { kind: 'google'; claims: GoogleClaims }

function unauthorized(): Response {
  return Response.json(
    { error: 'unauthorized' },
    { status: 401, headers: { 'www-authenticate': 'Bearer' } },
  )
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 })
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

async function storeUser(env: Env, claims: GoogleClaims): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, picture, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       picture = excluded.picture`,
  )
    .bind(claims.sub, claims.email, claims.name ?? null, claims.picture ?? null, new Date().toISOString())
    .run()
}

/**
 * The static service token carries no Google identity. It maps to the user who
 * signed in with the single allowed email; without that row there is no owner
 * to scope the data to.
 */
async function resolveUserId(env: Env, auth: AuthContext): Promise<string | null> {
  if (auth.kind === 'google') return auth.claims.sub
  if (!env.ALLOWED_EMAIL) return null

  const row = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = lower(?)')
    .bind(env.ALLOWED_EMAIL)
    .first<{ id: string }>()

  return row?.id ?? null
}

async function readProfile(env: Env, userId: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT weight_kg AS weight,
            height_cm AS height,
            sex,
            birth_date AS birthDate,
            target_kcal AS targetKcal
     FROM profiles
     WHERE user_id = ?`,
  )
    .bind(userId)
    .first<Record<string, unknown>>()

  return Response.json(profileFromRow(row))
}

async function saveProfile(request: Request, env: Env, userId: string): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('Richiesta non valida.')
  }

  const parsed = parseProfile(body)
  if (!parsed.ok) return badRequest(parsed.error)

  const now = new Date().toISOString()
  const { weight, height, sex, birthDate, targetKcal } = parsed.value

  await env.DB.prepare(
    `INSERT INTO profiles
       (user_id, weight_kg, height_cm, sex, birth_date, weight_updated_at, target_kcal, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       weight_kg = excluded.weight_kg,
       height_cm = excluded.height_cm,
       sex = excluded.sex,
       birth_date = excluded.birth_date,
       weight_updated_at = excluded.weight_updated_at,
       target_kcal = excluded.target_kcal,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, weight, height, sex, birthDate, now, targetKcal, now)
    .run()

  return Response.json(parsed.value)
}

async function handleProfile(request: Request, env: Env, userId: string): Promise<Response> {
  if (request.method === 'GET') return readProfile(env, userId)
  if (request.method === 'PUT') return saveProfile(request, env, userId)
  return Response.json({ error: 'method_not_allowed' }, { status: 405 })
}

type RouteHandler = (
  request: Request,
  env: Env,
  userId: string,
  params: string[],
) => Promise<Response> | Response

interface ApiRoute {
  method: string
  pattern: RegExp
  handler: RouteHandler
}

const routes: ApiRoute[] = [
  {
    method: 'GET',
    pattern: /^\/api\/profile$/,
    handler: (request, env, userId) => handleProfile(request, env, userId),
  },
  {
    method: 'PUT',
    pattern: /^\/api\/profile$/,
    handler: (request, env, userId) => handleProfile(request, env, userId),
  },
  {
    method: 'GET',
    pattern: /^\/api\/days\/(\d{4}-\d{2}-\d{2})$/,
    handler: (_request, env, userId, [date]) => getDay(env, userId, date!),
  },
  {
    method: 'GET',
    pattern: /^\/api\/activities$/,
    handler: (_request, env, userId) => listActivities(env, userId),
  },
  {
    method: 'POST',
    pattern: /^\/api\/activities$/,
    handler: (request, env, userId) => createActivity(request, env, userId),
  },
  {
    method: 'POST',
    pattern: /^\/api\/activity-entries$/,
    handler: (request, env, userId) => createActivityEntry(request, env, userId),
  },
  {
    method: 'POST',
    pattern: /^\/api\/meals$/,
    handler: (request, env, userId) => createMeal(request, env, userId),
  },
  {
    method: 'PUT',
    pattern: /^\/api\/meals\/([^/]+)$/,
    handler: (request, env, userId, [id]) => updateMeal(request, env, userId, id!),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/meals\/([^/]+)$/,
    handler: (_request, env, userId, [id]) => deleteMeal(env, userId, id!),
  },
  {
    method: 'GET',
    pattern: /^\/api\/foods$/,
    handler: (_request, env, userId) => listFoods(env, userId),
  },
  {
    method: 'GET',
    pattern: /^\/api\/export$/,
    handler: (request, env, userId) => exportDiary(request, env, userId),
  },
  {
    method: 'POST',
    pattern: /^\/api\/foods$/,
    handler: (request, env, userId) => createFood(request, env, userId),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/foods\/([^/]+)$/,
    handler: (request, env, userId, [id]) => updateFood(request, env, userId, id!),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/foods\/([^/]+)$/,
    handler: (_request, env, userId, [id]) => deleteFood(env, userId, id!),
  },
  {
    method: 'GET',
    pattern: /^\/api\/foods\/search$/,
    handler: (request, env) => searchFoods(request, env),
  },
  {
    method: 'GET',
    pattern: /^\/api\/foods\/off\/([^/]+)$/,
    handler: (_request, env, _userId, [code]) => getOffProduct(env, code!),
  },
]

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

    if (auth?.kind === 'google') await storeUser(env, auth.claims)

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

    if (!pathname.startsWith('/api/')) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }

    const userId = await resolveUserId(env, auth!)
    if (!userId) {
      return Response.json(
        {
          error:
            "Accesso di servizio senza utente: accedi una volta con Google usando ALLOWED_EMAIL, poi riprova.",
        },
        { status: 403 },
      )
    }

    let pathMatched = false
    for (const route of routes) {
      const match = route.pattern.exec(pathname)
      if (!match) continue
      pathMatched = true
      if (route.method !== request.method) continue
      return route.handler(request, env, userId, match.slice(1))
    }

    if (pathMatched) {
      return Response.json({ error: 'method_not_allowed' }, { status: 405 })
    }

    return Response.json({ error: 'not_found' }, { status: 404 })
  },
}
