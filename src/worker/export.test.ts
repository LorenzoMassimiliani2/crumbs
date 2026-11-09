import { beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase } from '@/test/d1'
import { installGoogleIdentity } from '@/test/google'
import type { Env } from './env'
import worker from './index'

const CLIENT_ID = 'test-client.apps.googleusercontent.com'
const OWNER_EMAIL = 'owner@example.com'
const SERVICE_TOKEN = 'test-service-token'

const PANE_PER_100G = {
  kcal: 356,
  protein: 12,
  carbs: 70,
  fat: 1.5,
  fiber: 3,
  sugar: 2,
  salt: 1,
}

const PANE = {
  name: 'Pane',
  source: 'off',
  sourceId: '123',
  brand: 'Forno',
  grams: 150,
  per100g: PANE_PER_100G,
}

const MELA = {
  name: 'Mela',
  source: 'manual',
  sourceId: null,
  brand: null,
  grams: 200,
  per100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, salt: 0 },
}

function testEnv(): Env {
  return {
    DB: createTestDatabase(),
    API_TOKEN: SERVICE_TOKEN,
    GOOGLE_CLIENT_ID: CLIENT_ID,
    ALLOWED_EMAIL: OWNER_EMAIL,
  } as unknown as Env
}

function call(env: Env, path: string, token = SERVICE_TOKEN) {
  return worker.fetch(
    new Request(`https://crumbs.test${path}`, { headers: { Authorization: `Bearer ${token}` } }),
    env,
  )
}

async function seedUser(env: Env, id = 'user-1', email = OWNER_EMAIL): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, created_at) VALUES (?, ?, 'Owner', '2026-01-01T00:00:00.000Z')",
  )
    .bind(id, email)
    .run()
}

function mealBody(overrides: Record<string, unknown> = {}) {
  return {
    occurredAt: '2026-11-05T12:30:00.000Z',
    localDate: '2026-11-05',
    type: 'pranzo',
    note: null,
    items: [PANE],
    ...overrides,
  }
}

async function createMeal(env: Env, body: unknown, token = SERVICE_TOKEN): Promise<string> {
  const response = await worker.fetch(
    new Request('https://crumbs.test/api/meals', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  )
  expect(response.status).toBe(201)
  return ((await response.json()) as { id: string }).id
}

interface ExportItem {
  date: string
  type: string
  name: string
  grams: number
  kcal: number
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  sugar: number | null
  salt: number | null
  source: string
}

interface ExportDay {
  date: string
  kcal: number
  targetKcal: number | null
  delta: number | null
  protein: number
  carbs: number
  fat: number
}

interface ExportActivity {
  date: string
  name: string
  startedAt: string
  endedAt: string
  durationMinutes: number
  note: string | null
}

interface ExportPayload {
  from: string
  to: string
  targetKcal: number | null
  items: ExportItem[]
  days: ExportDay[]
  activities: ExportActivity[]
}

let env: Env

beforeEach(async () => {
  env = testEnv()
  await seedUser(env)
  await env.DB.prepare(
    `INSERT INTO profiles (user_id, weight_kg, height_cm, sex, birth_date, target_kcal, updated_at)
     VALUES ('user-1', 78, 178, 'm', '1990-04-12', 2200, '2026-11-01T00:00:00.000Z')`,
  ).run()
})

async function seedDiary(): Promise<void> {
  await createMeal(
    env,
    mealBody({ occurredAt: '2026-11-04T07:15:00.000Z', localDate: '2026-11-04', type: 'colazione' }),
  )
  await createMeal(env, mealBody({ occurredAt: '2026-11-05T12:30:00.000Z', items: [PANE, MELA] }))
  const removed = await createMeal(
    env,
    mealBody({ occurredAt: '2026-11-05T19:30:00.000Z', type: 'cena' }),
  )
  expect(
    (
      await worker.fetch(
        new Request(`https://crumbs.test/api/meals/${removed}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
        }),
        env,
      )
    ).status,
  ).toBe(204)
  await createMeal(env, mealBody({ occurredAt: '2026-10-31T13:00:00.000Z', localDate: '2026-10-31' }))
}

async function createActivity(env: Env, name: string): Promise<string> {
  const response = await worker.fetch(
    new Request('https://crumbs.test/api/activities', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
    env,
  )
  expect(response.status).toBe(201)
  return ((await response.json()) as { id: string }).id
}

async function createActivityEntry(
  env: Env,
  activityId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await worker.fetch(
    new Request('https://crumbs.test/api/activity-entries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId,
        localDate: '2026-11-05',
        startedAt: '2026-11-05T18:00:00.000Z',
        endedAt: '2026-11-05T19:00:00.000Z',
        ...overrides,
      }),
    }),
    env,
  )
  expect(response.status).toBe(201)
  return ((await response.json()) as { id: string }).id
}

describe('GET /api/export', () => {
  it('returns the non-deleted items and the per-day totals of the range', async () => {
    await seedDiary()

    const response = await call(env, '/api/export?from=2026-11-01&to=2026-11-30')
    expect(response.status).toBe(200)

    const payload = (await response.json()) as ExportPayload
    expect(payload.from).toBe('2026-11-01')
    expect(payload.to).toBe('2026-11-30')
    expect(payload.targetKcal).toBe(2200)

    expect(payload.items).toEqual([
      {
        date: '2026-11-04',
        type: 'colazione',
        name: 'Pane',
        grams: 150,
        kcal: 534,
        protein: 18,
        carbs: 105,
        fat: 2.25,
        fiber: 4.5,
        sugar: 3,
        salt: 1.5,
        source: 'off',
      },
      {
        date: '2026-11-05',
        type: 'pranzo',
        name: 'Pane',
        grams: 150,
        kcal: 534,
        protein: 18,
        carbs: 105,
        fat: 2.25,
        fiber: 4.5,
        sugar: 3,
        salt: 1.5,
        source: 'off',
      },
      {
        date: '2026-11-05',
        type: 'pranzo',
        name: 'Mela',
        grams: 200,
        kcal: 104,
        protein: 0.6,
        carbs: 28,
        fat: 0.4,
        fiber: 4.8,
        sugar: 20,
        salt: 0,
        source: 'manual',
      },
    ])

    expect(payload.days).toEqual([
      {
        date: '2026-11-04',
        kcal: 534,
        targetKcal: 2200,
        delta: 1666,
        protein: 18,
        carbs: 105,
        fat: 2.25,
      },
      {
        date: '2026-11-05',
        kcal: 638,
        targetKcal: 2200,
        delta: 1562,
        protein: 18.6,
        carbs: 133,
        fat: 2.65,
      },
    ])
  })

  it('returns null for nutrients the meal item does not know', async () => {
    await createMeal(env, mealBody({ items: [{ ...PANE, per100g: { kcal: 100 } }] }))

    const payload = (await (
      await call(env, '/api/export?from=2026-11-01&to=2026-11-30')
    ).json()) as ExportPayload

    expect(payload.items[0]).toMatchObject({
      kcal: 150,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      salt: null,
    })
    expect(payload.days[0]).toMatchObject({
      kcal: 150,
      protein: 0,
      carbs: 0,
      fat: 0,
    })
  })

  it('honours the date range boundaries and excludes a deleted meal', async () => {
    await seedDiary()

    const single = (await (
      await call(env, '/api/export?from=2026-11-04&to=2026-11-04')
    ).json()) as ExportPayload
    expect(single.items.map((item) => item.date)).toEqual(['2026-11-04'])
    expect(single.days.map((day) => day.date)).toEqual(['2026-11-04'])

    const november = (await (
      await call(env, '/api/export?from=2026-10-01&to=2026-11-30')
    ).json()) as ExportPayload
    expect(november.items).toHaveLength(4)
    expect(november.items.some((item) => item.type === 'cena')).toBe(false)
    expect(november.days.map((day) => day.date)).toEqual(['2026-10-31', '2026-11-04', '2026-11-05'])
  })

  it('returns the non-deleted activities of the range ordered by date and start', async () => {
    const corsa = await createActivity(env, 'Corsa')
    const camminata = await createActivity(env, 'Camminata')

    await createActivityEntry(env, camminata, {
      localDate: '2026-11-05',
      startedAt: '2026-11-05T18:00:00.000Z',
      endedAt: '2026-11-05T19:00:00.000Z',
      note: 'Con il cane',
    })
    await createActivityEntry(env, camminata, {
      localDate: '2026-11-04',
      startedAt: '2026-11-04T07:00:00.000Z',
      endedAt: '2026-11-04T07:30:00.000Z',
    })
    const removed = await createActivityEntry(env, corsa, {
      localDate: '2026-11-05',
      startedAt: '2026-11-05T06:00:00.000Z',
      endedAt: '2026-11-05T06:30:00.000Z',
    })
    expect(
      (
        await worker.fetch(
          new Request(`https://crumbs.test/api/activity-entries/${removed}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
          }),
          env,
        )
      ).status,
    ).toBe(204)
    await createActivityEntry(env, corsa, {
      localDate: '2026-10-31',
      startedAt: '2026-10-31T09:00:00.000Z',
      endedAt: '2026-10-31T09:30:00.000Z',
    })

    const payload = (await (
      await call(env, '/api/export?from=2026-11-01&to=2026-11-30')
    ).json()) as ExportPayload

    expect(payload.activities).toEqual([
      {
        date: '2026-11-04',
        name: 'Camminata',
        startedAt: '2026-11-04T07:00:00.000Z',
        endedAt: '2026-11-04T07:30:00.000Z',
        durationMinutes: 30,
        note: null,
      },
      {
        date: '2026-11-05',
        name: 'Camminata',
        startedAt: '2026-11-05T18:00:00.000Z',
        endedAt: '2026-11-05T19:00:00.000Z',
        durationMinutes: 60,
        note: 'Con il cane',
      },
    ])
  })

  it('exports an activity that crosses midnight with its full duration', async () => {
    const camminata = await createActivity(env, 'Camminata')
    await createActivityEntry(env, camminata, {
      localDate: '2026-11-05',
      startedAt: '2026-11-05T23:00:00+01:00',
      endedAt: '2026-11-06T01:00:00+01:00',
    })

    const payload = (await (
      await call(env, '/api/export?from=2026-11-05&to=2026-11-05')
    ).json()) as ExportPayload

    expect(payload.activities).toHaveLength(1)
    expect(payload.activities[0]).toMatchObject({ date: '2026-11-05', durationMinutes: 120 })
  })

  it('returns an empty result for a range without meals', async () => {
    await seedDiary()

    const response = await call(env, '/api/export?from=2025-01-01&to=2025-01-31')
    expect(response.status).toBe(200)
    const payload = (await response.json()) as ExportPayload
    expect(payload.items).toEqual([])
    expect(payload.days).toEqual([])
    expect(payload.activities).toEqual([])
  })

  it('does not leak the meals of another user', async () => {
    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)
    const otherToken = await identity.sign({ sub: 'user-2' })
    await createMeal(env, mealBody(), otherToken)

    const payload = (await (
      await call(env, '/api/export?from=2026-11-01&to=2026-11-30')
    ).json()) as ExportPayload
    expect(payload.items).toEqual([])
  })

  it('rejects missing, malformed or inverted dates', async () => {
    const invalid = [
      '/api/export',
      '/api/export?from=2026-11-01',
      '/api/export?to=2026-11-30',
      '/api/export?from=2026-11-01&to=11/30/2026',
      '/api/export?from=2026-02-30&to=2026-03-01',
      '/api/export?from=2026-13-01&to=2026-13-31',
      '/api/export?from=2026-12-01&to=2026-11-01',
    ]

    for (const path of invalid) {
      const response = await call(env, path)
      expect(response.status, path).toBe(400)
      const body = (await response.json()) as { error?: unknown }
      expect(typeof body.error).toBe('string')
    }
  })

  it('requires a credential', async () => {
    const response = await worker.fetch(
      new Request('https://crumbs.test/api/export?from=2026-11-01&to=2026-11-30'),
      env,
    )
    expect(response.status).toBe(401)
  })
})
