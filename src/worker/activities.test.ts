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
      weight: 78,
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
