import { beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase } from '@/test/d1'
import { installGoogleIdentity } from '@/test/google'
import type { Env } from './env'
import worker from './index'

const CLIENT_ID = 'test-client.apps.googleusercontent.com'
const OWNER_EMAIL = 'owner@example.com'
const SERVICE_TOKEN = 'test-service-token'

const TORTA_PER_100G = {
  kcal: 400,
  protein: 5,
  carbs: 50,
  fat: 20,
  fiber: 2,
  sugar: 30,
  salt: 0.5,
}

const TORTA = { name: 'Torta della nonna', per100g: TORTA_PER_100G }

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

async function listFoods(env: Env): Promise<Record<string, unknown>[]> {
  const response = await call(env, 'GET', '/api/foods')
  expect(response.status).toBe(200)
  return (await response.json()) as Record<string, unknown>[]
}

let env: Env

beforeEach(async () => {
  env = testEnv()
  await seedUser(env)
})

describe('POST /api/foods', () => {
  it('creates a manual food with name and per-100g values', async () => {
    const response = await call(env, 'POST', '/api/foods', TORTA)
    expect(response.status).toBe(201)

    const food = (await response.json()) as Record<string, unknown>
    expect(food).toMatchObject({
      name: 'Torta della nonna',
      brand: null,
      source: 'manual',
      sourceId: null,
      per100g: TORTA_PER_100G,
      lastUsedAt: null,
    })
    expect(food.id).toEqual(expect.any(String))

    const foods = await listFoods(env)
    expect(foods).toHaveLength(1)
    expect(foods[0]).toMatchObject({ id: food.id, name: 'Torta della nonna', source: 'manual' })

    const row = await env.DB.prepare(
      'SELECT source, source_id, kcal_100g, protein_100g FROM foods',
    ).first<Record<string, unknown>>()
    expect(row).toEqual({
      source: 'manual',
      source_id: null,
      kcal_100g: 400,
      protein_100g: 5,
    })
  })

  it('rejects an empty name, negative values and a non-positive serving', async () => {
    const invalidBodies: unknown[] = [
      { ...TORTA, name: '   ' },
      { ...TORTA, name: undefined },
      { ...TORTA, per100g: { ...TORTA_PER_100G, kcal: -1 } },
      { ...TORTA, per100g: { ...TORTA_PER_100G, fat: -0.5 } },
      { ...TORTA, per100g: { ...TORTA_PER_100G, salt: 'tanto' } },
      { ...TORTA, per100g: 'no' },
      { ...TORTA, servingG: 0 },
      { ...TORTA, servingG: -10 },
      { ...TORTA, servingLabel: 42 },
      '{',
    ]

    for (const body of invalidBodies) {
      const response = await call(env, 'POST', '/api/foods', body)
      expect(response.status, JSON.stringify(body)).toBe(400)
      const payload = (await response.json()) as { error?: unknown }
      expect(typeof payload.error).toBe('string')
    }

    expect(await listFoods(env)).toEqual([])
  })

  it('stores omitted optional macros as null instead of zero', async () => {
    const response = await call(env, 'POST', '/api/foods', {
      name: 'Mistero',
      per100g: { kcal: 100, protein: null },
    })
    expect(response.status).toBe(201)

    const food = (await response.json()) as { per100g: Record<string, unknown> }
    expect(food.per100g).toEqual({
      kcal: 100,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      salt: null,
    })

    expect((await listFoods(env))[0]).toMatchObject({
      per100g: { kcal: 100, protein: null, carbs: null, fat: null },
    })
  })

  it('stores an optional positive serving', async () => {
    const response = await call(env, 'POST', '/api/foods', {
      ...TORTA,
      servingG: 60,
      servingLabel: 'una fetta',
    })
    expect(response.status).toBe(201)
    const food = (await response.json()) as Record<string, unknown>
    expect(food).toMatchObject({ servingG: 60, servingLabel: 'una fetta' })
    expect((await listFoods(env))[0]).toMatchObject({ servingG: 60, servingLabel: 'una fetta' })
  })

  it('updates the existing manual food instead of duplicating an equivalent name', async () => {
    const created = (await (await call(env, 'POST', '/api/foods', TORTA)).json()) as { id: string }

    const response = await call(env, 'POST', '/api/foods', {
      name: '  torta DELLA nonna ',
      per100g: { ...TORTA_PER_100G, kcal: 420 },
    })
    expect(response.status).toBe(200)

    const updated = (await response.json()) as Record<string, unknown>
    expect(updated.id).toBe(created.id)
    expect(updated).toMatchObject({ name: 'torta DELLA nonna', per100g: { kcal: 420 } })

    const foods = await listFoods(env)
    expect(foods).toHaveLength(1)
    expect(foods[0]).toMatchObject({ id: created.id, name: 'torta DELLA nonna' })
  })

describe('PATCH /api/foods/:id', () => {
  async function createFavorite(overrides: Record<string, unknown> = {}) {
    const response = await call(env, 'POST', '/api/foods', { ...TORTA, ...overrides })
    return (await response.json()) as { id: string }
  }

  function mealWith(name: string, per100g: Record<string, number>, grams: number, localDate: string) {
    return {
      occurredAt: `${localDate}T12:30:00.000Z`,
      localDate,
      type: 'pranzo',
      items: [
        { name, source: 'manual', sourceId: null, brand: null, grams, per100g },
      ],
    }
  }

  it('updates name and values for future meals while saved meals keep their snapshot', async () => {
    const food = await createFavorite()
    await call(env, 'POST', '/api/meals', mealWith('Torta della nonna', TORTA_PER_100G, 100, '2026-11-05'))

    const response = await call(env, 'PATCH', `/api/foods/${food.id}`, {
      name: 'Torta nonna',
      per100g: { ...TORTA_PER_100G, kcal: 500 },
      servingG: 80,
    })
    expect(response.status).toBe(200)

    const updated = (await response.json()) as Record<string, unknown>
    expect(updated).toMatchObject({
      id: food.id,
      name: 'Torta nonna',
      per100g: { ...TORTA_PER_100G, kcal: 500 },
      servingG: 80,
    })

    const foods = await listFoods(env)
    expect(foods).toEqual([
      expect.objectContaining({
        id: food.id,
        name: 'Torta nonna',
        per100g: { ...TORTA_PER_100G, kcal: 500 },
      }),
    ])

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      meals: { items: { per100g: unknown; totals: unknown }[] }[]
    }
    expect(day.meals[0]!.items[0]!.per100g).toEqual(TORTA_PER_100G)
    expect(day.meals[0]!.items[0]!.totals).toMatchObject({ kcal: 400, protein: 5 })
  })

  it('accepts a partial update and keeps the other values', async () => {
    const food = await createFavorite()

    const response = await call(env, 'PATCH', `/api/foods/${food.id}`, {
      per100g: { ...TORTA_PER_100G, sugar: 12 },
    })
    expect(response.status).toBe(200)

    const updated = (await response.json()) as Record<string, unknown>
    expect(updated).toMatchObject({ name: 'Torta della nonna', per100g: { ...TORTA_PER_100G, sugar: 12 } })

    expect(
      (await call(env, 'PATCH', `/api/foods/${food.id}`, { name: 'Torta della nonna' })).status,
    ).toBe(200)
  })

  it('accepts null optional macros and stores them as null', async () => {
    const food = await createFavorite()

    const response = await call(env, 'PATCH', `/api/foods/${food.id}`, {
      per100g: { kcal: 400, protein: null },
    })
    expect(response.status).toBe(200)

    const updated = (await response.json()) as { per100g: Record<string, unknown> }
    expect(updated.per100g).toEqual({
      kcal: 400,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      salt: null,
    })
  })

  it('returns 409 without writing when the new name belongs to another manual food', async () => {
    const first = await createFavorite({ name: 'Torta della nonna' })
    await createFavorite({ name: 'Mela' })

    const response = await call(env, 'PATCH', `/api/foods/${first.id}`, {
      name: '  MELA ',
    })
    expect(response.status).toBe(409)
    expect(((await response.json()) as { error: string }).error).toEqual(expect.any(String))

    expect((await listFoods(env)).map((food) => food.name).sort()).toEqual([
      'Mela',
      'Torta della nonna',
    ])
  })

  it('rejects invalid values without touching the row', async () => {
    const food = await createFavorite()
    const invalidBodies: unknown[] = [
      {},
      { name: '  ' },
      { per100g: { ...TORTA_PER_100G, kcal: -1 } },
      { per100g: { ...TORTA_PER_100G, protein: 'x' } },
      { servingG: 0 },
      { servingLabel: 42 },
      '{',
    ]

    for (const body of invalidBodies) {
      const response = await call(env, 'PATCH', `/api/foods/${food.id}`, body)
      expect(response.status, JSON.stringify(body)).toBe(400)
    }

    expect((await listFoods(env))[0]).toMatchObject({ name: 'Torta della nonna', per100g: TORTA_PER_100G })
  })

  it('returns 404 for an unknown food or one of another user', async () => {
    expect((await call(env, 'PATCH', '/api/foods/missing', { name: 'X' })).status).toBe(404)

    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)
    const otherToken = await identity.sign({ sub: 'user-2' })
    const other = (await (
      await call(env, 'POST', '/api/foods', TORTA, otherToken)
    ).json()) as { id: string }

    expect((await call(env, 'PATCH', `/api/foods/${other.id}`, { name: 'X' })).status).toBe(404)
  })
})
})

describe('DELETE /api/foods/:id', () => {
  it('removes the favorite and nulls the reference while meal items keep their snapshot', async () => {
    const food = (await (await call(env, 'POST', '/api/foods', TORTA)).json()) as { id: string }
    await call(env, 'POST', '/api/meals', {
      occurredAt: '2026-11-05T12:30:00.000Z',
      localDate: '2026-11-05',
      type: 'pranzo',
      items: [
        {
          name: TORTA.name,
          source: 'manual',
          sourceId: null,
          brand: null,
          grams: 100,
          per100g: TORTA_PER_100G,
        },
      ],
    })

    const response = await call(env, 'DELETE', `/api/foods/${food.id}`)
    expect(response.status).toBe(204)
    expect(await listFoods(env)).toEqual([])

    const item = await env.DB.prepare(
      'SELECT food_id, name_snapshot, kcal_100g, grams FROM meal_items',
    ).first<Record<string, unknown>>()
    expect(item).toEqual({
      food_id: null,
      name_snapshot: 'Torta della nonna',
      kcal_100g: 400,
      grams: 100,
    })

    const day = (await (await call(env, 'GET', '/api/days/2026-11-05')).json()) as {
      totals: unknown
      meals: { items: Record<string, unknown>[] }[]
    }
    expect(day.totals).toMatchObject({ kcal: 400 })
    expect(day.meals[0]!.items[0]).toMatchObject({
      name: 'Torta della nonna',
      per100g: TORTA_PER_100G,
      totals: { kcal: 400 },
    })
  })

  it('returns 404 for an unknown food or one of another user', async () => {
    expect((await call(env, 'DELETE', '/api/foods/missing')).status).toBe(404)

    const identity = await installGoogleIdentity(CLIENT_ID, OWNER_EMAIL)
    const otherToken = await identity.sign({ sub: 'user-2' })
    const other = (await (
      await call(env, 'POST', '/api/foods', TORTA, otherToken)
    ).json()) as { id: string }

    expect((await call(env, 'DELETE', `/api/foods/${other.id}`)).status).toBe(404)
    expect((await listFoods(env)).length).toBe(0)
  })
})

describe('authentication', () => {
  it('rejects every favorites route without a credential', async () => {
    const requests: [string, string][] = [
      ['GET', '/api/foods'],
      ['POST', '/api/foods'],
      ['PATCH', '/api/foods/food-1'],
      ['DELETE', '/api/foods/food-1'],
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
