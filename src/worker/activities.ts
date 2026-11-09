import { activityDurationMinutes, type Activity, type DayActivity } from '../lib/activity'
import type { Env } from './env'
import { isRealDate, toUtcInstant } from './meals'

const MAX_NAME = 80
const MAX_NOTE = 500

export const DEFAULT_ACTIVITIES = [
  'Camminata',
  'Corsa',
  'Bicicletta',
  'Palestra',
  'Nuoto',
  'Yoga',
  'Pilates',
  'Calcetto',
  'Tennis',
  'Escursione',
] as const

interface ActivityRow {
  id: string
  name: string
  last_used_at: string | null
}

interface EntryRow {
  id: string
  activity_id: string | null
  name_snapshot: string
  started_at: string
  ended_at: string
  note: string | null
}

function activityFromRow(row: ActivityRow): Activity {
  return { id: row.id, name: row.name, lastUsedAt: row.last_used_at }
}

function entryFromRow(row: EntryRow): DayActivity {
  return {
    id: row.id,
    activityId: row.activity_id,
    name: row.name_snapshot,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: activityDurationMinutes(row.started_at, row.ended_at),
    note: row.note,
  }
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 })
}

function notFound(): Response {
  return Response.json({ error: 'Attività non trovata.' }, { status: 404 })
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function seedDefaults(env: Env, userId: string, now: string): Promise<void> {
  await env.DB.batch(
    DEFAULT_ACTIVITIES.map((name) =>
      env.DB.prepare(
        `INSERT INTO activities (id, user_id, name, last_used_at, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?)`,
      ).bind(crypto.randomUUID(), userId, name, now, now),
    ),
  )
}

export async function listActivities(env: Env, userId: string): Promise<Response> {
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM activities WHERE user_id = ?')
    .bind(userId)
    .first<{ n: number }>()

  if ((count?.n ?? 0) === 0) {
    await seedDefaults(env, userId, new Date().toISOString())
  }

  const rows = await env.DB.prepare(
    `SELECT id, name, last_used_at
     FROM activities
     WHERE user_id = ?
     ORDER BY last_used_at DESC, lower(name) ASC`,
  )
    .bind(userId)
    .all<ActivityRow>()

  return Response.json(rows.results.map(activityFromRow))
}

/** A name is required and at most 80 characters; surrounding spaces are trimmed. */
function parseName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name.length > 0 && name.length <= MAX_NAME ? name : null
}

function parseNote(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.length <= MAX_NOTE ? trimmed : undefined
}

export async function createActivity(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const body = await readJson(request)
  if (body === null || typeof body !== 'object') return badRequest('Richiesta non valida.')

  const name = parseName((body as Record<string, unknown>).name)
  if (name === null) {
    return badRequest(`Il nome dell'attività è obbligatorio e può avere al massimo ${MAX_NAME} caratteri.`)
  }

  const now = new Date().toISOString()
  const activity: Activity = { id: crypto.randomUUID(), name, lastUsedAt: null }

  await env.DB.prepare(
    `INSERT INTO activities (id, user_id, name, last_used_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?)`,
  )
    .bind(activity.id, userId, activity.name, now, now)
    .run()

  return Response.json(activity, { status: 201 })
}

export async function createActivityEntry(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const body = await readJson(request)
  if (body === null || typeof body !== 'object') return badRequest('Richiesta non valida.')
  const input = body as Record<string, unknown>

  const activityId = input.activityId
  if (typeof activityId !== 'string' || activityId.length === 0) {
    return badRequest("Seleziona un'attività.")
  }

  const activity = await env.DB.prepare(
    'SELECT id, name FROM activities WHERE id = ? AND user_id = ?',
  )
    .bind(activityId, userId)
    .first<{ id: string; name: string }>()
  if (!activity) return notFound()

  if (!isRealDate(input.localDate)) return badRequest('La data locale non è valida.')

  const startedAt = toUtcInstant(input.startedAt)
  if (startedAt === null) return badRequest("L'orario di inizio non è valido.")
  const endedAt = toUtcInstant(input.endedAt)
  if (endedAt === null) return badRequest("L'orario di fine non è valido.")
  if (Date.parse(endedAt) <= Date.parse(startedAt)) {
    return badRequest("L'ora di fine deve essere successiva all'ora di inizio.")
  }

  const note = parseNote(input.note)
  if (note === undefined) return badRequest('La nota non è valida.')

  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO activity_entries
         (id, user_id, activity_id, name_snapshot, local_date, started_at, ended_at, note,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      userId,
      activityId,
      activity.name,
      input.localDate,
      startedAt,
      endedAt,
      note,
      now,
      now,
    ),
    env.DB.prepare(
      'UPDATE activities SET last_used_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    ).bind(now, now, activityId, userId),
  ])

  return Response.json(
    {
      id,
      activityId,
      name: activity.name,
      startedAt,
      endedAt,
      durationMinutes: activityDurationMinutes(startedAt, endedAt),
      note,
    } satisfies DayActivity,
    { status: 201 },
  )
}

export async function listDayActivities(
  env: Env,
  userId: string,
  date: string,
): Promise<DayActivity[]> {
  const rows = await env.DB.prepare(
    `SELECT id, activity_id, name_snapshot, started_at, ended_at, note
     FROM activity_entries
     WHERE user_id = ? AND local_date = ? AND deleted_at IS NULL
     ORDER BY started_at ASC, id ASC`,
  )
    .bind(userId, date)
    .all<EntryRow>()

  return rows.results.map(entryFromRow)
}
