import {
  activityDurationMinutes,
  MAX_ACTIVITY_MINUTES,
  type Activity,
  type DayActivity,
} from '../lib/activity'
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

/** Renames a catalog activity; saved diary entries keep their own name snapshot. */
export async function updateActivity(
  request: Request,
  env: Env,
  userId: string,
  activityId: string,
): Promise<Response> {
  const body = await readJson(request)
  if (body === null || typeof body !== 'object') return badRequest('Richiesta non valida.')

  const name = parseName((body as Record<string, unknown>).name)
  if (name === null) {
    return badRequest(`Il nome dell'attività è obbligatorio e può avere al massimo ${MAX_NAME} caratteri.`)
  }

  const existing = await env.DB.prepare(
    'SELECT id, last_used_at FROM activities WHERE id = ? AND user_id = ?',
  )
    .bind(activityId, userId)
    .first<{ id: string; last_used_at: string | null }>()
  if (!existing) return notFound()

  await env.DB.prepare(
    'UPDATE activities SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?',
  )
    .bind(name, new Date().toISOString(), activityId, userId)
    .run()

  return Response.json({ id: activityId, name, lastUsedAt: existing.last_used_at } satisfies Activity)
}

/** Removes a catalog activity and unlinks its diary entries, which keep their name snapshot. */
export async function deleteActivity(
  env: Env,
  userId: string,
  activityId: string,
): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM activities WHERE id = ? AND user_id = ?')
    .bind(activityId, userId)
    .first<{ id: string }>()
  if (!existing) return notFound()

  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE activity_entries SET activity_id = NULL, updated_at = ? WHERE activity_id = ? AND user_id = ?',
    ).bind(now, activityId, userId),
    env.DB.prepare('DELETE FROM activities WHERE id = ? AND user_id = ?').bind(activityId, userId),
  ])

  return new Response(null, { status: 204 })
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

interface EntryFields {
  activityId: string
  localDate: string
  startedAt: string
  endedAt: string
  note: string | null
}

type ParsedEntry = { ok: true; value: EntryFields } | { ok: false; error: string }

/** Validates the payload shared by create and update; the activity is looked up separately. */
function parseEntryFields(body: unknown): ParsedEntry {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Richiesta non valida.' }
  }
  const input = body as Record<string, unknown>

  const activityId = input.activityId
  if (typeof activityId !== 'string' || activityId.length === 0) {
    return { ok: false, error: "Seleziona un'attività." }
  }

  if (!isRealDate(input.localDate)) {
    return { ok: false, error: 'La data locale non è valida.' }
  }

  const startedAt = toUtcInstant(input.startedAt)
  if (startedAt === null) return { ok: false, error: "L'orario di inizio non è valido." }
  const endedAt = toUtcInstant(input.endedAt)
  if (endedAt === null) return { ok: false, error: "L'orario di fine non è valido." }
  const durationMs = Date.parse(endedAt) - Date.parse(startedAt)
  if (durationMs <= 0) {
    return { ok: false, error: "L'ora di fine deve essere successiva all'ora di inizio." }
  }
  if (durationMs > MAX_ACTIVITY_MINUTES * 60_000) {
    return { ok: false, error: "La durata dell'attività non può superare le 24 ore." }
  }

  const note = parseNote(input.note)
  if (note === undefined) return { ok: false, error: 'La nota non è valida.' }

  return {
    ok: true,
    value: { activityId, localDate: input.localDate, startedAt, endedAt, note },
  }
}

async function findActivity(
  env: Env,
  userId: string,
  activityId: string,
): Promise<{ id: string; name: string } | null> {
  return env.DB.prepare('SELECT id, name FROM activities WHERE id = ? AND user_id = ?')
    .bind(activityId, userId)
    .first<{ id: string; name: string }>()
}

export async function createActivityEntry(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const parsed = parseEntryFields(await readJson(request))
  if (!parsed.ok) return badRequest(parsed.error)
  const input = parsed.value
  const { activityId, localDate, startedAt, endedAt, note } = input

  const activity = await findActivity(env, userId, activityId)
  if (!activity) return notFound()

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
      localDate,
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

/**
 * Rewrites activity, times and note of an existing entry. The stored name snapshot
 * only changes when the entry switches to a different catalog activity; catalog
 * renames never rewrite history. Editing does not reorder the catalog either.
 */
export async function updateActivityEntry(
  request: Request,
  env: Env,
  userId: string,
  entryId: string,
): Promise<Response> {
  const parsed = parseEntryFields(await readJson(request))
  if (!parsed.ok) return badRequest(parsed.error)
  const input = parsed.value

  const existing = await env.DB.prepare(
    `SELECT activity_id, name_snapshot FROM activity_entries
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
  )
    .bind(entryId, userId)
    .first<{ activity_id: string | null; name_snapshot: string }>()
  if (!existing) return notFound()

  const activity = await findActivity(env, userId, input.activityId)
  if (!activity) return notFound()

  const name = existing.activity_id === activity.id ? existing.name_snapshot : activity.name
  const now = new Date().toISOString()

  await env.DB.prepare(
    `UPDATE activity_entries
     SET activity_id = ?, name_snapshot = ?, local_date = ?, started_at = ?, ended_at = ?,
         note = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(
      activity.id,
      name,
      input.localDate,
      input.startedAt,
      input.endedAt,
      input.note,
      now,
      entryId,
      userId,
    )
    .run()

  return Response.json({
    id: entryId,
    activityId: activity.id,
    name,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMinutes: activityDurationMinutes(input.startedAt, input.endedAt),
    note: input.note,
  } satisfies DayActivity)
}

/** Soft delete; deleting an already deleted entry of the same user is a success. */
export async function deleteActivityEntry(
  env: Env,
  userId: string,
  entryId: string,
): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT id FROM activity_entries WHERE id = ? AND user_id = ?',
  )
    .bind(entryId, userId)
    .first<{ id: string }>()
  if (!existing) return notFound()

  const now = new Date().toISOString()
  await env.DB.prepare(
    `UPDATE activity_entries SET deleted_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
  )
    .bind(now, now, entryId, userId)
    .run()

  return new Response(null, { status: 204 })
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
