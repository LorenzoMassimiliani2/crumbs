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

const PANE_TOTALS = {
  kcal: 534,
  protein: 18,
  carbs: 105,
  fat: 2.25,
  fiber: 4.5,
  sugar: 3,
  salt: 1.5,
}

function testEnv(): Env {
  return {
    DB: createTestDatabase(),
    API_TOKEN: SERVICE_TOKEN,
    GOOGLE_CLIENT_ID: CLIENT_ID,
    ALLOWED_EMAIL: OWNER_EMAIL,
  } as unknown as Env
}

function call(env: Env, method: string, path: string, body?: unknown, token = SERVICE_TOKEN) {
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}` } }
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

function mealBody(overrides: Record<string, unknown> = {}) {
  return {
    occurredAt: '2026-11-05T12:30:00.000Z',
    localDate: '2026-11-05',
    type: 'pranzo',
    note: 'Pranzo veloce',
    items: [PANE],
    ...overrides,
  }
}

async function count(env: Env, table: 'meals' | 'meal_items' | 'foods'): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>()
  return row?.n ?? 0
}

let env: Env

beforeEach(async () => {
  env = testEnv()
  await seedUser(env)
})

describe('POST /api/meals', () => {
  it('creates a meal with items and computes the literal totals', async () => {
    const response = await call(env, 'POST', '/api/meals', mealBody())
    expect(response.status).toBe(201)

    const meal = (await response.json()) as Record<string, unknown>
    expect(meal).toMatchObject({
      type: 'pranzo',
      occurredAt: '2026-11-05T12:30:00.000Z',
      localDate: '2026-11-05',
      note: 'Pranzo veloce',
      totals: PANE_TOTALS,
    })
    expect(meal.items).toEqual([
      expect.objectContaining({
        name: 'Pane',
        source: 'off',
        brand: 'Forno',
        sourceId: '123',
        grams: 150,
        per100g: PANE_PER_100G,
        totals: PANE_TOTALS,
      }),
    ])
  })

  it('stores unknown fiber, sugar and salt as null and ignores them in totals', async () => {
    const item = {
      ...PANE,
      per100g: { kcal: 356, protein: 12, carbs: 70, fat: 1.5 },
    }

    const response = await call(env, 'POST', '/api/meals', mealBody({ items: [item] }))
    expect(response.status).toBe(201)

    const meal = (await response.json()) as {
      items: { per100g: Record<string, unknown> }[]
      totals: Record<string, number>
    }
    expect(meal.items[0]!.per100g).toEqual({
      kcal: 356,
      protein: 12,
      carbs: 70,
      fat: 1.5,
      fiber: null,
      sugar: null,
      salt: null,
    })
    expect(meal.totals).toMatchObject({ kcal: 534, fiber: 0, sugar: 0, salt: 0 })

    const row = await env.DB.prepare(
      'SELECT fiber_100g, sugar_100g, salt_100g FROM meal_items',
    ).first<Record<string, unknown>>()
    expect(row).toEqual({ fiber_100g: null, sugar_100g: null, salt_100g: null })

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      items?: unknown
      totals: Record<string, number>
      meals: { items: { per100g: Record<string, unknown> }[] }[]
    }
    expect(day.meals[0]!.items[0]!.per100g).toMatchObject({
      fiber: null,
      sugar: null,
      salt: null,
    })
    expect(day.totals).toMatchObject({ kcal: 534, fiber: 0, sugar: 0, salt: 0 })

    const created = (await (await call(env, 'POST', '/api/meals', mealBody())).json()) as {
      id: string
    }
    const updated = await call(env, 'PUT', `/api/meals/${created.id}`, {
      type: 'pranzo',
      items: [
        {
          ...PANE,
          per100g: { kcal: 356, protein: 12, carbs: 70, fat: 1.5, fiber: null, sugar: null, salt: null },
        },
      ],
    })
    expect(updated.status).toBe(200)
    const updatedBody = (await updated.json()) as { items: { per100g: Record<string, unknown> }[] }
    expect(updatedBody.items[0]!.per100g).toMatchObject({ fiber: null, sugar: null, salt: null })
  })

  it('requires a credential', async () => {
    const response = await worker.fetch(
      new Request('https://crumbs.test/api/meals', { method: 'POST' }),
      env,
    )
    expect(response.status).toBe(401)
  })

  it('returns 400 and writes nothing when any item is invalid', async () => {
    const invalidBodies: unknown[] = [
      mealBody({ type: 'spuntino' }),
      mealBody({ occurredAt: 'non-una-data' }),
      mealBody({ localDate: '2026-02-30' }),
      mealBody({ items: [] }),
      mealBody({ items: Array.from({ length: 51 }, () => PANE) }),
      mealBody({ items: [{ ...PANE, grams: 0 }] }),
      mealBody({ items: [{ ...PANE, grams: 5001 }] }),
      mealBody({ items: [{ ...PANE, name: '  ' }] }),
      mealBody({ items: [{ ...PANE, source: 'web' }] }),
      mealBody({ items: [{ ...PANE, per100g: { ...PANE_PER_100G, kcal: -1 } }] }),
      mealBody({ items: [{ ...PANE, per100g: { ...PANE_PER_100G, kcal: undefined } }] }),
      mealBody({ items: [PANE, { ...PANE, grams: -5 }] }),
      '{',
    ]

    for (const body of invalidBodies) {
      const response = await call(env, 'POST', '/api/meals', body)
      expect(response.status, JSON.stringify(body)).toBe(400)
      const payload = (await response.json()) as { error?: unknown }
      expect(typeof payload.error).toBe('string')
    }

    expect(await count(env, 'meals')).toBe(0)
    expect(await count(env, 'meal_items')).toBe(0)
    expect(await count(env, 'foods')).toBe(0)
  })
})

describe('GET /api/days/:date', () => {
  it('returns the target, day totals and non-deleted meals ordered by time', async () => {
    await call(env, 'PUT', '/api/profile', {
      weight: 78,
      height: 178,
      sex: 'm',
      birthDate: '1990-04-12',
      targetKcal: 2200,
    })

    const evening = await call(
      env,
      'POST',
      '/api/meals',
      mealBody({ occurredAt: '2026-11-05T19:30:00.000Z', type: 'cena' }),
    )
    const morning = await call(
      env,
      'POST',
      '/api/meals',
      mealBody({ occurredAt: '2026-11-05T07:15:00.000Z', type: 'colazione' }),
    )
    const removed = await call(
      env,
      'POST',
      '/api/meals',
      mealBody({ occurredAt: '2026-11-05T10:00:00.000Z', type: 'merenda_mattina' }),
    )
    const removedId = ((await removed.json()) as { id: string }).id
    await call(env, 'DELETE', `/api/meals/${removedId}`)

    const eveningId = ((await evening.json()) as { id: string }).id
    const morningId = ((await morning.json()) as { id: string }).id

    const response = await call(env, 'GET', '/api/days/2026-11-05')
    expect(response.status).toBe(200)

    const day = (await response.json()) as {
      date: string
      targetKcal: number
      totals: Record<string, number>
      meals: { id: string }[]
    }
    expect(day.date).toBe('2026-11-05')
    expect(day.targetKcal).toBe(2200)
    expect(day.totals).toEqual({
      kcal: 1068,
      protein: 36,
      carbs: 210,
      fat: 4.5,
      fiber: 9,
      sugar: 6,
      salt: 3,
    })
    expect(day.meals.map((meal) => meal.id)).toEqual([morningId, eveningId])
  })

  it('keeps the localDate sent by the client and stores occurredAt in UTC', async () => {
    const response = await call(
      env,
      'POST',
      '/api/meals',
      mealBody({
        occurredAt: '2026-11-04T23:30:00.000Z',
        localDate: '2026-11-05',
      }),
    )
    expect(response.status).toBe(201)

    const row = await env.DB.prepare('SELECT occurred_at, local_date FROM meals').first<{
      occurred_at: string
      local_date: string
    }>()
    expect(row).toEqual({ occurred_at: '2026-11-04T23:30:00.000Z', local_date: '2026-11-05' })

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      meals: unknown[]
    }
    expect(day.meals).toHaveLength(1)
  })

  it('does not leak meals of another user', async () => {
    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)
    const otherToken = await identity.sign({ sub: 'user-2' })

    const other = await call(env, 'POST', '/api/meals', mealBody(), otherToken)
    expect(other.status).toBe(201)

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      meals: unknown[]
    }
    expect(day.meals).toEqual([])
  })

  it('rejects an invalid date', async () => {
    const response = await call(env, 'GET', '/api/days/2026-13-01')
    expect(response.status).toBe(400)
  })
})

describe('PUT and DELETE /api/meals/:id', () => {
  it('replaces the items and recomputes the totals', async () => {
    const created = (await (await call(env, 'POST', '/api/meals', mealBody())).json()) as {
      id: string
    }

    const response = await call(env, 'PUT', `/api/meals/${created.id}`, {
      type: 'colazione',
      note: null,
      items: [{ ...PANE, grams: 100 }],
    })
    expect(response.status).toBe(200)

    const updated = (await response.json()) as { type: string; note: unknown; totals: unknown; items: unknown[] }
    expect(updated.type).toBe('colazione')
    expect(updated.note).toBeNull()
    expect(updated.totals).toEqual(PANE_PER_100G)
    expect(updated.items).toHaveLength(1)

    const items = await env.DB.prepare('SELECT COUNT(*) AS n FROM meal_items').first<{ n: number }>()
    expect(items?.n).toBe(1)

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      totals: unknown
    }
    expect(day.totals).toEqual(PANE_PER_100G)
  })

  it('returns 404 for an unknown or deleted meal', async () => {
    expect(
      (await call(env, 'PUT', '/api/meals/missing', { type: 'pranzo', items: [PANE] })).status,
    ).toBe(404)

    const created = (await (await call(env, 'POST', '/api/meals', mealBody())).json()) as {
      id: string
    }
    await call(env, 'DELETE', `/api/meals/${created.id}`)

    expect(
      (await call(env, 'PUT', `/api/meals/${created.id}`, { type: 'pranzo', items: [PANE] })).status,
    ).toBe(404)
  })

  it('does not update a meal of another user', async () => {
    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)
    const otherToken = await identity.sign({ sub: 'user-2' })
    const created = (await (
      await call(env, 'POST', '/api/meals', mealBody(), otherToken)
    ).json()) as { id: string }

    const response = await call(env, 'PUT', `/api/meals/${created.id}`, {
      type: 'cena',
      items: [PANE],
    })
    expect(response.status).toBe(404)
  })

  it('soft-deletes idempotently and hides the meal from the day', async () => {
    const created = (await (await call(env, 'POST', '/api/meals', mealBody())).json()) as {
      id: string
    }

    expect((await call(env, 'DELETE', `/api/meals/${created.id}`)).status).toBe(204)
    expect((await call(env, 'DELETE', `/api/meals/${created.id}`)).status).toBe(204)

    const row = await env.DB.prepare('SELECT deleted_at FROM meals WHERE id = ?')
      .bind(created.id)
      .first<{ deleted_at: string | null }>()
    expect(row?.deleted_at).toEqual(expect.any(String))

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      meals: unknown[]
    }
    expect(day.meals).toEqual([])
    const items = await env.DB.prepare('SELECT COUNT(*) AS n FROM meal_items').first<{ n: number }>()
    expect(items?.n).toBe(1)
  })

  it('returns 400 without writing when the replacement is invalid', async () => {
    const created = (await (await call(env, 'POST', '/api/meals', mealBody())).json()) as {
      id: string
    }

    const response = await call(env, 'PUT', `/api/meals/${created.id}`, {
      type: 'pranzo',
      items: [{ ...PANE, grams: 0 }],
    })
    expect(response.status).toBe(400)

    const items = await env.DB.prepare('SELECT COUNT(*) AS n FROM meal_items').first<{ n: number }>()
    expect(items?.n).toBe(1)
  })
})

describe('favorites upsert', () => {
  it('saves each inserted food as a favorite and dedupes by source and external id', async () => {
    await call(env, 'POST', '/api/meals', mealBody())
    const first = await env.DB.prepare('SELECT id, last_used_at FROM foods').all<{
      id: string
      last_used_at: string
    }>()
    expect(first.results).toHaveLength(1)

    await env.DB.prepare("UPDATE foods SET last_used_at = '2020-01-01T00:00:00.000Z'").run()
    await call(env, 'POST', '/api/meals', mealBody({ note: null }))

    const after = await env.DB.prepare('SELECT id, last_used_at FROM foods').all<{
      id: string
      last_used_at: string
    }>()
    expect(after.results).toHaveLength(1)
    expect(after.results[0]!.id).toBe(first.results[0]!.id)
    expect(after.results[0]!.last_used_at).not.toBe('2020-01-01T00:00:00.000Z')
  })

  it('dedupes manual foods by normalized name', async () => {
    const manual = { ...PANE, source: 'manual', sourceId: null, name: 'Torta della nonna' }
    await call(env, 'POST', '/api/meals', mealBody({ items: [manual] }))
    await call(
      env,
      'POST',
      '/api/meals',
      mealBody({ items: [{ ...manual, name: '  torta della nonna ', grams: 80 }] }),
    )

    const foods = await env.DB.prepare('SELECT name FROM foods').all<{ name: string }>()
    expect(foods.results).toHaveLength(1)
    expect(foods.results[0]!.name.trim().toLowerCase()).toBe('torta della nonna')
  })

  it('keeps source and brand after the favorite is deleted', async () => {
    const created = await call(env, 'POST', '/api/meals', mealBody())
    expect(created.status).toBe(201)

    await env.DB.prepare('DELETE FROM foods').run()
    const item = await env.DB.prepare('SELECT food_id FROM meal_items').first<{
      food_id: string | null
    }>()
    expect(item?.food_id).toBeNull()

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      meals: { items: Record<string, unknown>[] }[]
    }
    expect(day.meals[0]!.items[0]).toMatchObject({
      name: 'Pane',
      source: 'off',
      brand: 'Forno',
      sourceId: '123',
      per100g: PANE_PER_100G,
      totals: PANE_TOTALS,
    })
  })

  it('keeps the saved snapshot when the favorite changes', async () => {
    await call(env, 'POST', '/api/meals', mealBody())
    await env.DB.prepare('UPDATE foods SET kcal_100g = 999, protein_100g = 99').run()

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      meals: { items: { per100g: unknown; totals: unknown }[] }[]
    }
    expect(day.meals[0]!.items[0]!.per100g).toEqual(PANE_PER_100G)
    expect(day.meals[0]!.items[0]!.totals).toEqual(PANE_TOTALS)
  })
})

describe('authentication', () => {
  it('rejects every diary route without a credential', async () => {
    const requests: [string, string][] = [
      ['GET', '/api/days/2026-11-05'],
      ['POST', '/api/meals'],
      ['PUT', '/api/meals/meal-1'],
      ['DELETE', '/api/meals/meal-1'],
      ['GET', '/api/foods'],
    ]

    for (const [method, path] of requests) {
      const response = await worker.fetch(
        new Request(`https://crumbs.test${path}`, { method }),
        env,
      )
      expect(response.status, `${method} ${path}`).toBe(401)
    }
  })
})

describe('GET /api/foods', () => {
  it('lists the favorites by last use and requires a credential', async () => {
    await call(
      env,
      'POST',
      '/api/meals',
      mealBody({
        items: [
          PANE,
          {
            name: 'Mela',
            source: 'manual',
            sourceId: null,
            brand: null,
            grams: 100,
            per100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, salt: 0 },
          },
        ],
      }),
    )

    const rows = await env.DB.prepare('SELECT id, name FROM foods').all<{ id: string; name: string }>()
    const mela = rows.results.find((row) => row.name === 'Mela')!
    const pane = rows.results.find((row) => row.name === 'Pane')!
    await env.DB.prepare("UPDATE foods SET last_used_at = '2026-11-04T00:00:00.000Z' WHERE id = ?")
      .bind(mela.id)
      .run()
    await env.DB.prepare("UPDATE foods SET last_used_at = '2026-11-05T00:00:00.000Z' WHERE id = ?")
      .bind(pane.id)
      .run()

    const response = await call(env, 'GET', '/api/foods')
    expect(response.status).toBe(200)
    const foods = (await response.json()) as { name: string; per100g: unknown }[]
    expect(foods.map((food) => food.name)).toEqual(['Pane', 'Mela'])
    expect(foods[0]!.per100g).toMatchObject({ kcal: 356, protein: 12 })

    const anonymous = await worker.fetch(new Request('https://crumbs.test/api/foods'), env)
    expect(anonymous.status).toBe(401)
  })
})
