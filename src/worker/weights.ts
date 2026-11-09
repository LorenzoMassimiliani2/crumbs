import type { WeightEntry } from '../lib/weight'
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '../lib/weight'
import type { Env } from './env'
import { isRealDate } from './meals'

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 })
}

function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** The client sends its local date; a missing or unreal value falls back to UTC today. */
function resolveToday(value: string | null): string {
  return isRealDate(value) ? value : utcToday()
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

async function seedFromProfile(env: Env, userId: string, today: string): Promise<void> {
  // The flag makes the seed one-shot: a user who clears the log keeps it empty.
  const claimed = await env.DB.prepare(
    'UPDATE users SET weights_seeded = 1 WHERE id = ? AND weights_seeded = 0',
  )
    .bind(userId)
    .run()
  if (claimed.meta.changes !== 1) return

  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM weight_entries WHERE user_id = ?',
  )
    .bind(userId)
    .first<{ n: number }>()
  if ((count?.n ?? 0) > 0) return

  const profile = await env.DB.prepare('SELECT weight_kg FROM profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ weight_kg: number }>()
  if (!profile) return

  const now = new Date().toISOString()
  await env.DB.prepare(
    `INSERT OR IGNORE INTO weight_entries
       (id, user_id, measured_on, weight_kg, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), userId, today, profile.weight_kg, now, now)
    .run()
}

export async function listWeights(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const today = resolveToday(new URL(request.url).searchParams.get('today'))
  await seedFromProfile(env, userId, today)

  const rows = await env.DB.prepare(
    `SELECT measured_on AS date, weight_kg AS weight
     FROM weight_entries
     WHERE user_id = ?
     ORDER BY measured_on ASC`,
  )
    .bind(userId)
    .all<WeightEntry>()

  return Response.json(rows.results)
}

/**
 * Creates or replaces the measurement of a date. The profile weight cache is
 * rewritten from the latest stored measurement in the same transaction, so a
 * backdated entry never moves the current weight.
 */
export async function upsertWeight(
  request: Request,
  env: Env,
  userId: string,
  date: string,
): Promise<Response> {
  if (!isRealDate(date)) return badRequest('Data non valida.')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('Richiesta non valida.')
  }

  const weight =
    body !== null && typeof body === 'object'
      ? toNumber((body as Record<string, unknown>).weight)
      : null
  if (weight === null || weight < MIN_WEIGHT_KG || weight > MAX_WEIGHT_KG) {
    return badRequest('Il peso deve essere compreso tra 30 e 300 kg.')
  }

  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO weight_entries (id, user_id, measured_on, weight_kg, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, measured_on) DO UPDATE SET
         weight_kg = excluded.weight_kg,
         updated_at = excluded.updated_at`,
    ).bind(crypto.randomUUID(), userId, date, weight, now, now),
    env.DB.prepare(
      `UPDATE profiles
       SET weight_kg = (
             SELECT weight_kg FROM weight_entries
             WHERE user_id = ? ORDER BY measured_on DESC LIMIT 1
           ),
           weight_updated_at = ?,
           updated_at = ?
       WHERE user_id = ?
         AND EXISTS (SELECT 1 FROM weight_entries WHERE user_id = ?)`,
    ).bind(userId, now, now, userId, userId),
  ])

  return Response.json({ date, weight } satisfies WeightEntry)
}
