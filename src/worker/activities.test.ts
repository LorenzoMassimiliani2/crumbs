import { beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase } from '@/test/d1'
import type { Env } from './env'
import worker from './index'

const SERVICE_TOKEN = 'test-service-token'
const OWNER_EMAIL = 'owner@example.com'

function testEnv(): Env {
  return {
    DB: createTestDatabase(),
    API_TOKEN: SERVICE_TOKEN,
    ALLOWED_EMAIL: OWNER_EMAIL,
  } as unknown as Env
}

function call(env: Env, method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${SERVICE_TOKEN}` } }
  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' }
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  return worker.fetch(new Request(`https://crumbs.test${path}`, init), env)
}

async function seedUser(env: Env, id = 'user-1', email = OWNER_EMAIL): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, created_at) VALUES (?, ?, 'Owner', '2026-01-01T00:00:00.000Z')",
  )
    .bind(id, email)
    .run()
}

async function createActivity(env: Env, name: string): Promise<string> {
  const response = await call(env, 'POST', '/api/activities', { name })
  expect(response.status).toBe(201)
  return ((await response.json()) as { id: string }).id
}

function entryBody(activityId: string, overrides: Record<string, unknown> = {}) {
  return {
    activityId,
    localDate: '2026-11-05',
    startedAt: '2026-11-05T12:00:00.000Z',
    endedAt: '2026-11-05T13:30:00.000Z',
    ...overrides,
  }
}

let env: Env

beforeEach(async () => {
  env = testEnv()
  await seedUser(env)
})

describe('GET /api/activities', () => {
  it('seeds the ten default activities on first access', async () => {
    const response = await call(env, 'GET', '/api/activities')
    expect(response.status).toBe(200)

    const activities = (await response.json()) as { name: string; lastUsedAt: unknown }[]
    expect(activities.map((activity) => activity.name)).toEqual([
      'Bicicletta',
      'Calcetto',
      'Camminata',
      'Corsa',
      'Escursione',
      'Nuoto',
      'Palestra',
      'Pilates',
      'Tennis',
      'Yoga',
    ])
    expect(activities.every((activity) => activity.lastUsedAt === null)).toBe(true)
  })

  it('does not seed again when the catalog already has entries', async () => {
    await call(env, 'GET', '/api/activities')
    const activities = (await (await call(env, 'GET', '/api/activities')).json()) as unknown[]
    expect(activities).toHaveLength(10)

    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM activities').first<{ n: number }>()
    expect(row?.n).toBe(10)
  })

  it('does not reseed after the user deletes every catalog activity', async () => {
    const seeded = (await (await call(env, 'GET', '/api/activities')).json()) as {
      id: string
    }[]
    for (const activity of seeded) {
      expect((await call(env, 'DELETE', `/api/activities/${activity.id}`)).status).toBe(204)
    }

    const response = await call(env, 'GET', '/api/activities')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })

  it('puts used activities above unused ones and sorts unused alphabetically', async () => {
    const seeded = (await (await call(env, 'GET', '/api/activities')).json()) as {
      id: string
      name: string
    }[]
    const corsaId = seeded.find((activity) => activity.name === 'Corsa')!.id
    const zumbaId = await createActivity(env, 'Zumba')
    await call(env, 'POST', '/api/activity-entries', entryBody(corsaId))
    await call(env, 'POST', '/api/activity-entries', entryBody(zumbaId))

    const activities = (await (await call(env, 'GET', '/api/activities')).json()) as {
      name: string
      lastUsedAt: string | null
    }[]

    expect(activities.slice(0, 2).map((activity) => activity.name).sort()).toEqual([
      'Corsa',
      'Zumba',
    ])
    expect(activities.slice(2).every((activity) => activity.lastUsedAt === null)).toBe(true)
    const unusedNames = activities.slice(2).map((activity) => activity.name)
    expect(unusedNames).toEqual([...unusedNames].sort((a, b) => a.localeCompare(b)))
  })

  it('requires a credential', async () => {
    const response = await worker.fetch(
      new Request('https://crumbs.test/api/activities'),
      env,
    )
    expect(response.status).toBe(401)
  })
})

describe('POST /api/activities', () => {
  it('creates a catalog activity with no last use', async () => {
    const response = await call(env, 'POST', '/api/activities', { name: '  Arrampicata ' })
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      id: expect.any(String),
      name: 'Arrampicata',
      lastUsedAt: null,
    })
  })

  it('rejects an empty name or one longer than 80 characters', async () => {
    for (const body of [{ name: '   ' }, { name: 'x'.repeat(81) }, {}]) {
      const response = await call(env, 'POST', '/api/activities', body)
      expect(response.status, JSON.stringify(body)).toBe(400)
    }

    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM activities').first<{ n: number }>()
    expect(row?.n).toBe(0)
  })
})

describe('POST /api/activity-entries', () => {
  it('saves the name snapshot and returns the derived duration', async () => {
    const activityId = await createActivity(env, 'Camminata')

    const response = await call(env, 'POST', '/api/activity-entries', {
      ...entryBody(activityId),
      note: 'Con il cane',
    })
    expect(response.status).toBe(201)

    const entry = (await response.json()) as Record<string, unknown>
    expect(entry).toEqual({
      id: expect.any(String),
      activityId,
      name: 'Camminata',
      startedAt: '2026-11-05T12:00:00.000Z',
      endedAt: '2026-11-05T13:30:00.000Z',
      durationMinutes: 90,
      note: 'Con il cane',
    })

    const row = await env.DB.prepare(
      'SELECT name_snapshot, local_date, note FROM activity_entries',
    ).first<Record<string, unknown>>()
    expect(row).toEqual({
      name_snapshot: 'Camminata',
      local_date: '2026-11-05',
      note: 'Con il cane',
    })
  })

  it('marks the catalog activity as used', async () => {
    const activityId = await createActivity(env, 'Nuoto')
    await call(env, 'POST', '/api/activity-entries', entryBody(activityId))

    const row = await env.DB.prepare(
      'SELECT last_used_at FROM activities WHERE id = ?',
    )
      .bind(activityId)
      .first<{ last_used_at: string | null }>()
    expect(row?.last_used_at).toEqual(expect.any(String))
  })

  it('accepts an end on the following day and derives the night duration', async () => {
    const activityId = await createActivity(env, 'Corsa')

    const response = await call(
      env,
      'POST',
      '/api/activity-entries',
      entryBody(activityId, {
        startedAt: '2026-11-05T23:00:00.000Z',
        endedAt: '2026-11-06T01:00:00.000Z',
      }),
    )
    expect(response.status).toBe(201)

    const entry = (await response.json()) as { durationMinutes: number; endedAt: string }
    expect(entry.durationMinutes).toBe(120)
    expect(entry.endedAt).toBe('2026-11-06T01:00:00.000Z')
  })

  it('accepts exactly 24 hours and rejects anything longer', async () => {
    const activityId = await createActivity(env, 'Escursione')

    const fullDay = await call(
      env,
      'POST',
      '/api/activity-entries',
      entryBody(activityId, {
        startedAt: '2026-11-05T12:00:00.000Z',
        endedAt: '2026-11-06T12:00:00.000Z',
      }),
    )
    expect(fullDay.status).toBe(201)
    expect(((await fullDay.json()) as { durationMinutes: number }).durationMinutes).toBe(1440)

    const tooLong = await call(
      env,
      'POST',
      '/api/activity-entries',
      entryBody(activityId, {
        startedAt: '2026-11-05T12:00:00.000Z',
        endedAt: '2026-11-06T12:01:00.000Z',
      }),
    )
    expect(tooLong.status).toBe(400)
    expect(((await tooLong.json()) as { error: string }).error).toContain('24 ore')

    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM activity_entries',
    ).first<{ n: number }>()
    expect(row?.n).toBe(1)
  })

  it('rejects an end that is not after the start and writes nothing', async () => {
    const activityId = await createActivity(env, 'Yoga')

    for (const overrides of [
      { endedAt: '2026-11-05T12:00:00.000Z' },
      { endedAt: '2026-11-05T11:00:00.000Z' },
    ]) {
      const response = await call(
        env,
        'POST',
        '/api/activity-entries',
        entryBody(activityId, overrides),
      )
      expect(response.status).toBe(400)
      expect(((await response.json()) as { error: unknown }).error).toEqual(expect.any(String))
    }

    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM activity_entries',
    ).first<{ n: number }>()
    expect(row?.n).toBe(0)
  })

  it('rejects malformed dates, instants and notes with 400', async () => {
    const activityId = await createActivity(env, 'Corsa')

    for (const overrides of [
      { localDate: '2026-02-30' },
      { localDate: 'ieri' },
      { startedAt: '2026-11-05T12:00:00' },
      { endedAt: 'non-una-data' },
      { note: 'x'.repeat(501) },
    ]) {
      const response = await call(
        env,
        'POST',
        '/api/activity-entries',
        entryBody(activityId, overrides),
      )
      expect(response.status, JSON.stringify(overrides)).toBe(400)
    }
  })

  it('returns 404 for an activity that does not exist or belongs to another user', async () => {
    const missing = await call(env, 'POST', '/api/activity-entries', entryBody('missing'))
    expect(missing.status).toBe(404)

    await seedUser(env, 'user-2', 'other@example.com')
    const foreignId = 'foreign-activity'
    await env.DB.prepare(
      "INSERT INTO activities (id, user_id, name, created_at, updated_at) VALUES (?, 'user-2', 'Corsa', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
    )
      .bind(foreignId)
      .run()
    const foreign = await call(env, 'POST', '/api/activity-entries', entryBody(foreignId))
    expect(foreign.status).toBe(404)
  })

  it('requires a credential', async () => {
    const response = await worker.fetch(
      new Request('https://crumbs.test/api/activity-entries', { method: 'POST' }),
      env,
    )
    expect(response.status).toBe(401)
  })
})

describe('GET /api/days/:date', () => {
  it('includes the activities of the day ordered by start and leaves totals unchanged', async () => {
    await call(env, 'PUT', '/api/profile', {
      height: 178,
      sex: 'm',
      birthDate: '1990-04-12',
      targetKcal: 2200,
    })
    await call(env, 'POST', '/api/meals', {
      occurredAt: '2026-11-05T13:00:00.000Z',
      localDate: '2026-11-05',
      type: 'pranzo',
      items: [
        {
          name: 'Pane',
          source: 'manual',
          sourceId: null,
          brand: null,
          grams: 100,
          per100g: { kcal: 100, protein: 1, carbs: null, fat: null, fiber: null, sugar: null, salt: null },
        },
      ],
    })

    const camminata = await createActivity(env, 'Camminata')
    await call(
      env,
      'POST',
      '/api/activity-entries',
      entryBody(camminata, {
        startedAt: '2026-11-05T12:00:00.000Z',
        endedAt: '2026-11-05T13:30:00.000Z',
      }),
    )
    const yoga = await createActivity(env, 'Yoga')
    await call(
      env,
      'POST',
      '/api/activity-entries',
      entryBody(yoga, {
        startedAt: '2026-11-05T07:00:00.000Z',
        endedAt: '2026-11-05T08:00:00.000Z',
      }),
    )

    const response = await call(env, 'GET', '/api/days/2026-11-05')
    expect(response.status).toBe(200)

    const day = (await response.json()) as {
      targetKcal: number
      totals: Record<string, number>
      meals: unknown[]
      activities: { name: string; durationMinutes: number }[]
    }
    expect(day.targetKcal).toBe(2200)
    expect(day.totals).toMatchObject({ kcal: 100 })
    expect(day.meals).toHaveLength(1)
    expect(day.activities.map((activity) => activity.name)).toEqual(['Yoga', 'Camminata'])
    expect(day.activities[1]!.durationMinutes).toBe(90)
  })

  it('hides deleted activity entries', async () => {
    const corsa = await createActivity(env, 'Corsa')
    await call(env, 'POST', '/api/activity-entries', entryBody(corsa))
    await env.DB.prepare(
      "UPDATE activity_entries SET deleted_at = '2026-11-05T14:00:00.000Z'",
    ).run()

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      activities: unknown[]
    }
    expect(day.activities).toEqual([])
  })
})

async function createEntry(
  env: Env,
  activityId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; name: string; startedAt: string; note: string | null }> {
  const response = await call(env, 'POST', '/api/activity-entries', entryBody(activityId, overrides))
  expect(response.status).toBe(201)
  return (await response.json()) as { id: string; name: string; startedAt: string; note: string | null }
}

/** An entry owned by a second user, used to prove per-user scoping. */
async function seedForeignEntry(env: Env): Promise<string> {
  await seedUser(env, 'user-2', 'other@example.com')
  const id = 'foreign-entry'
  await env.DB.prepare(
    `INSERT INTO activity_entries
       (id, user_id, activity_id, name_snapshot, local_date, started_at, ended_at, note,
        created_at, updated_at)
     VALUES (?, 'user-2', NULL, 'Corsa', '2026-11-05', '2026-11-05T12:00:00.000Z',
             '2026-11-05T13:30:00.000Z', 'Altro', '2026-01-01T00:00:00.000Z',
             '2026-01-01T00:00:00.000Z')`,
  )
    .bind(id)
    .run()
  return id
}

async function entryCount(env: Env): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM activity_entries').first<{ n: number }>()
  return row?.n ?? 0
}

async function addMeal(env: Env): Promise<void> {
  const response = await call(env, 'POST', '/api/meals', {
    occurredAt: '2026-11-05T13:00:00.000Z',
    localDate: '2026-11-05',
    type: 'pranzo',
    items: [
      {
        name: 'Pane',
        source: 'manual',
        sourceId: null,
        brand: null,
        grams: 100,
        per100g: { kcal: 120, protein: 1, carbs: null, fat: null, fiber: null, sugar: null, salt: null },
      },
    ],
  })
  expect(response.status).toBe(201)
}

describe('PUT /api/activity-entries/:id', () => {
  it('updates the existing entry and returns its new values without adding a row', async () => {
    const corsa = await createActivity(env, 'Corsa')
    const entry = await createEntry(env, corsa, { note: 'Parco' })

    const response = await call(
      env,
      'PUT',
      `/api/activity-entries/${entry.id}`,
      entryBody(corsa, {
        startedAt: '2026-11-05T18:00:00.000Z',
        endedAt: '2026-11-05T19:30:00.000Z',
        note: 'Lungo fiume',
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      id: entry.id,
      activityId: corsa,
      name: 'Corsa',
      startedAt: '2026-11-05T18:00:00.000Z',
      endedAt: '2026-11-05T19:30:00.000Z',
      durationMinutes: 90,
      note: 'Lungo fiume',
    })

    expect(await entryCount(env)).toBe(1)
  })

  it('reorders the catalog when an edit switches to another activity', async () => {
    const corsa = await createActivity(env, 'Corsa')
    const yoga = await createActivity(env, 'Yoga')
    const entry = await createEntry(env, corsa)
    await env.DB.prepare(
      "UPDATE activities SET last_used_at = '2026-01-01T00:00:00.000Z' WHERE id = ?",
    )
      .bind(corsa)
      .run()

    const response = await call(
      env,
      'PUT',
      `/api/activity-entries/${entry.id}`,
      entryBody(yoga),
    )
    expect(response.status).toBe(200)

    const catalog = (await (await call(env, 'GET', '/api/activities')).json()) as {
      id: string
    }[]
    expect(catalog[0]!.id).toBe(yoga)
  })

  it('switches the activity and reads its name snapshot from the catalog', async () => {
    const corsa = await createActivity(env, 'Corsa')
    const yoga = await createActivity(env, 'Yoga')
    const entry = await createEntry(env, corsa)

    const response = await call(
      env,
      'PUT',
      `/api/activity-entries/${entry.id}`,
      entryBody(yoga, { note: null }),
    )
    expect(response.status).toBe(200)
    expect(((await response.json()) as { name: string }).name).toBe('Yoga')

    const row = await env.DB.prepare(
      'SELECT activity_id, name_snapshot FROM activity_entries WHERE id = ?',
    )
      .bind(entry.id)
      .first<{ activity_id: string; name_snapshot: string }>()
    expect(row).toEqual({ activity_id: yoga, name_snapshot: 'Yoga' })
  })

  it('keeps the stored name snapshot when the activity is unchanged', async () => {
    const corsa = await createActivity(env, 'Corsa')
    const entry = await createEntry(env, corsa)
    await env.DB.prepare("UPDATE activity_entries SET name_snapshot = 'Corsa vecchia' WHERE id = ?")
      .bind(entry.id)
      .run()

    const response = await call(
      env,
      'PUT',
      `/api/activity-entries/${entry.id}`,
      entryBody(corsa, { note: 'Corretta' }),
    )
    expect(response.status).toBe(200)
    expect(((await response.json()) as { name: string }).name).toBe('Corsa vecchia')
  })

  it('recalculates the day timeline after the times change and leaves totals alone', async () => {
    await call(env, 'PUT', '/api/profile', {
      height: 178,
      sex: 'm',
      birthDate: '1990-04-12',
      targetKcal: 2200,
    })
    await addMeal(env)
    const corsa = await createActivity(env, 'Corsa')
    const entry = await createEntry(env, corsa, {
      startedAt: '2026-11-05T18:00:00.000Z',
      endedAt: '2026-11-05T19:00:00.000Z',
    })

    await call(
      env,
      'PUT',
      `/api/activity-entries/${entry.id}`,
      entryBody(corsa, {
        startedAt: '2026-11-05T07:00:00.000Z',
        endedAt: '2026-11-05T08:00:00.000Z',
      }),
    )

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      totals: Record<string, number>
      activities: { id: string; startedAt: string }[]
    }
    expect(day.totals.kcal).toBe(120)
    expect(day.activities).toHaveLength(1)
    expect(day.activities[0]!.startedAt).toBe('2026-11-05T07:00:00.000Z')
  })

  it('rejects an invalid payload and writes nothing', async () => {
    const corsa = await createActivity(env, 'Corsa')
    const entry = await createEntry(env, corsa, { note: 'Parco' })

    const invalid = await call(
      env,
      'PUT',
      `/api/activity-entries/${entry.id}`,
      entryBody(corsa, { endedAt: '2026-11-05T11:00:00.000Z' }),
    )
    expect(invalid.status).toBe(400)

    const row = await env.DB.prepare(
      'SELECT ended_at, note FROM activity_entries WHERE id = ?',
    )
      .bind(entry.id)
      .first<{ ended_at: string; note: string | null }>()
    expect(row).toEqual({ ended_at: '2026-11-05T13:30:00.000Z', note: 'Parco' })
  })

  it('does not create catalog activities', async () => {
    const corsa = await createActivity(env, 'Corsa')
    const entry = await createEntry(env, corsa)

    await call(env, 'PUT', `/api/activity-entries/${entry.id}`, entryBody(corsa))

    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM activities').first<{ n: number }>()
    expect(row?.n).toBe(1)
    expect(await entryCount(env)).toBe(1)
  })

  it('returns 404 for a missing entry or one of another user', async () => {
    const corsa = await createActivity(env, 'Corsa')

    const missing = await call(env, 'PUT', '/api/activity-entries/missing', entryBody(corsa))
    expect(missing.status).toBe(404)

    const foreignId = await seedForeignEntry(env)
    const foreign = await call(env, 'PUT', `/api/activity-entries/${foreignId}`, entryBody(corsa))
    expect(foreign.status).toBe(404)

    const row = await env.DB.prepare('SELECT note FROM activity_entries WHERE id = ?')
      .bind(foreignId)
      .first<{ note: string | null }>()
    expect(row?.note).toBe('Altro')

    // A catalog activity of another user is not selectable either.
    await env.DB.prepare(
      "INSERT INTO activities (id, user_id, name, created_at, updated_at) VALUES ('foreign-activity', 'user-2', 'Corsa', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
    ).run()
    const ownEntry = await createEntry(env, corsa)
    const foreignActivity = await call(
      env,
      'PUT',
      `/api/activity-entries/${ownEntry.id}`,
      entryBody('foreign-activity'),
    )
    expect(foreignActivity.status).toBe(404)
  })
})

describe('DELETE /api/activity-entries/:id', () => {
  it('soft deletes the entry, hides it from the day and is idempotent', async () => {
    await addMeal(env)
    const corsa = await createActivity(env, 'Corsa')
    const entry = await createEntry(env, corsa)

    const first = await call(env, 'DELETE', `/api/activity-entries/${entry.id}`)
    expect(first.status).toBe(204)

    const row = await env.DB.prepare(
      'SELECT deleted_at FROM activity_entries WHERE id = ?',
    )
      .bind(entry.id)
      .first<{ deleted_at: string | null }>()
    expect(row?.deleted_at).toEqual(expect.any(String))

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      totals: Record<string, number>
      activities: unknown[]
    }
    expect(day.activities).toEqual([])
    expect(day.totals.kcal).toBe(120)

    const second = await call(env, 'DELETE', `/api/activity-entries/${entry.id}`)
    expect(second.status).toBe(204)
    expect(await entryCount(env)).toBe(1)
  })

  it('returns 404 for a missing entry or one of another user', async () => {
    expect((await call(env, 'DELETE', '/api/activity-entries/missing')).status).toBe(404)

    const foreignId = await seedForeignEntry(env)
    expect((await call(env, 'DELETE', `/api/activity-entries/${foreignId}`)).status).toBe(404)

    const row = await env.DB.prepare(
      'SELECT deleted_at FROM activity_entries WHERE id = ?',
    )
      .bind(foreignId)
      .first<{ deleted_at: string | null }>()
    expect(row?.deleted_at).toBeNull()
  })
})

describe('PATCH /api/activities/:id', () => {
  it('renames a catalog activity and returns it with its last use', async () => {
    const corsa = await createActivity(env, 'Corsa')
    await call(env, 'POST', '/api/activity-entries', entryBody(corsa))

    const response = await call(env, 'PATCH', `/api/activities/${corsa}`, { name: '  Corsa su strada ' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      id: corsa,
      name: 'Corsa su strada',
      lastUsedAt: expect.any(String),
    })

    const catalog = (await (await call(env, 'GET', '/api/activities')).json()) as {
      id: string
      name: string
    }[]
    expect(catalog.find((activity) => activity.id === corsa)?.name).toBe('Corsa su strada')
  })

  it('does not rewrite the names saved in the diary', async () => {
    const corsa = await createActivity(env, 'Corsa')
    const entry = await createEntry(env, corsa)

    await call(env, 'PATCH', `/api/activities/${corsa}`, { name: 'Corsa su strada' })

    const row = await env.DB.prepare(
      'SELECT activity_id, name_snapshot FROM activity_entries WHERE id = ?',
    )
      .bind(entry.id)
      .first<{ activity_id: string; name_snapshot: string }>()
    expect(row).toEqual({ activity_id: corsa, name_snapshot: 'Corsa' })

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      activities: { name: string }[]
    }
    expect(day.activities[0]!.name).toBe('Corsa')
  })

  it('renames the default catalog entries too', async () => {
    const seeded = (await (await call(env, 'GET', '/api/activities')).json()) as {
      id: string
      name: string
    }[]
    const camminata = seeded.find((activity) => activity.name === 'Camminata')!

    const response = await call(env, 'PATCH', `/api/activities/${camminata.id}`, {
      name: 'Passeggiata',
    })
    expect(response.status).toBe(200)

    const catalog = (await (await call(env, 'GET', '/api/activities')).json()) as {
      name: string
    }[]
    expect(catalog.map((activity) => activity.name)).toContain('Passeggiata')
    expect(catalog.map((activity) => activity.name)).not.toContain('Camminata')
  })

  it('rejects an empty name or one longer than 80 characters', async () => {
    const corsa = await createActivity(env, 'Corsa')

    for (const body of [{ name: '   ' }, { name: 'x'.repeat(81) }, {}]) {
      const response = await call(env, 'PATCH', `/api/activities/${corsa}`, body)
      expect(response.status, JSON.stringify(body)).toBe(400)
    }

    const row = await env.DB.prepare('SELECT name FROM activities WHERE id = ?')
      .bind(corsa)
      .first<{ name: string }>()
    expect(row?.name).toBe('Corsa')
  })

  it('returns 404 for a missing activity or one of another user', async () => {
    expect((await call(env, 'PATCH', '/api/activities/missing', { name: 'Corsa' })).status).toBe(
      404,
    )
    expect((await call(env, 'PATCH', '/api/activities/missing', { name: '' })).status).toBe(404)

    await seedUser(env, 'user-2', 'other@example.com')
    await env.DB.prepare(
      "INSERT INTO activities (id, user_id, name, created_at, updated_at) VALUES ('foreign-activity', 'user-2', 'Corsa', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
    ).run()

    const response = await call(env, 'PATCH', '/api/activities/foreign-activity', {
      name: 'Rubata',
    })
    expect(response.status).toBe(404)
    expect(
      (await call(env, 'PATCH', '/api/activities/foreign-activity', { name: '' })).status,
    ).toBe(404)

    const row = await env.DB.prepare("SELECT name FROM activities WHERE id = 'foreign-activity'")
      .first<{ name: string }>()
    expect(row?.name).toBe('Corsa')
  })

  it('requires a credential', async () => {
    const response = await worker.fetch(
      new Request('https://crumbs.test/api/activities/x', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Corsa' }),
      }),
      env,
    )
    expect(response.status).toBe(401)
  })
})

describe('DELETE /api/activities/:id', () => {
  it('removes the activity from the catalog and unlinks its diary entries', async () => {
    const corsa = await createActivity(env, 'Corsa')
    const other = await createActivity(env, 'Yoga')
    const entry = await createEntry(env, corsa)

    const response = await call(env, 'DELETE', `/api/activities/${corsa}`)
    expect(response.status).toBe(204)

    const catalog = (await (await call(env, 'GET', '/api/activities')).json()) as {
      id: string
    }[]
    expect(catalog.map((activity) => activity.id)).toEqual([other])

    const row = await env.DB.prepare(
      'SELECT activity_id, name_snapshot FROM activity_entries WHERE id = ?',
    )
      .bind(entry.id)
      .first<{ activity_id: string | null; name_snapshot: string }>()
    expect(row).toEqual({ activity_id: null, name_snapshot: 'Corsa' })

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      activities: { activityId: string | null; name: string }[]
    }
    expect(day.activities).toHaveLength(1)
    expect(day.activities[0]).toMatchObject({ activityId: null, name: 'Corsa' })
  })

  it('keeps the unlinked entry editable only after choosing an existing activity', async () => {
    const corsa = await createActivity(env, 'Corsa')
    const entry = await createEntry(env, corsa)
    await call(env, 'DELETE', `/api/activities/${corsa}`)

    const retry = await call(
      env,
      'PUT',
      `/api/activity-entries/${entry.id}`,
      entryBody(corsa),
    )
    expect(retry.status).toBe(404)

    const yoga = await createActivity(env, 'Yoga')
    const response = await call(env, 'PUT', `/api/activity-entries/${entry.id}`, entryBody(yoga))
    expect(response.status).toBe(200)
    expect(((await response.json()) as { name: string }).name).toBe('Yoga')

    const row = await env.DB.prepare(
      'SELECT activity_id, name_snapshot FROM activity_entries WHERE id = ?',
    )
      .bind(entry.id)
      .first<{ activity_id: string; name_snapshot: string }>()
    expect(row).toEqual({ activity_id: yoga, name_snapshot: 'Yoga' })
  })

  it('deletes the default catalog entries too', async () => {
    const seeded = (await (await call(env, 'GET', '/api/activities')).json()) as {
      id: string
      name: string
    }[]
    const nuoto = seeded.find((activity) => activity.name === 'Nuoto')!

    expect((await call(env, 'DELETE', `/api/activities/${nuoto.id}`)).status).toBe(204)

    const catalog = (await (await call(env, 'GET', '/api/activities')).json()) as {
      name: string
    }[]
    expect(catalog).toHaveLength(9)
    expect(catalog.map((activity) => activity.name)).not.toContain('Nuoto')
  })

  it('returns 404 for a missing activity or one of another user', async () => {
    expect((await call(env, 'DELETE', '/api/activities/missing')).status).toBe(404)

    await seedUser(env, 'user-2', 'other@example.com')
    await env.DB.prepare(
      "INSERT INTO activities (id, user_id, name, created_at, updated_at) VALUES ('foreign-activity', 'user-2', 'Corsa', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
    ).run()

    expect((await call(env, 'DELETE', '/api/activities/foreign-activity')).status).toBe(404)

    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM activities WHERE id = 'foreign-activity'")
      .first<{ n: number }>()
    expect(row?.n).toBe(1)
  })

  it('requires a credential', async () => {
    const response = await worker.fetch(
      new Request('https://crumbs.test/api/activities/x', { method: 'DELETE' }),
      env,
    )
    expect(response.status).toBe(401)
  })
})
