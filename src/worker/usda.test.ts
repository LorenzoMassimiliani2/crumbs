import { beforeEach, describe, expect, it } from 'vitest'

import { fetchStub } from '@/test/fetch'
import { createTestDatabase } from '@/test/d1'
import type { Env } from './env'
import worker from './index'

const OWNER_EMAIL = 'owner@example.com'
const SERVICE_TOKEN = 'test-service-token'
const USDA_KEY = 'test-usda-key'

const APPLE = {
  fdcId: 1750340,
  description: 'Apples, raw, with skin',
  foodNutrients: [
    { nutrientId: 208, amount: 52 },
    { nutrientId: 203, amount: 0.26 },
    { nutrientId: 205, amount: 13.81 },
    { nutrientId: 204, amount: 0.17 },
    { nutrientId: 307, amount: 240 },
  ],
  servingSize: 100,
  servingSizeUnit: 'g',
}

const RICE = {
  fdcId: 168878,
  description: 'Rice, white, cooked',
  foodNutrients: [
    { nutrientId: 208, amount: 999 },
    { nutrientId: 957, amount: 130 },
    { nutrientId: 203, amount: 2.69 },
    { nutrientId: 291, amount: 0.4 },
    { nutrientId: 269.3, amount: 0.05 },
  ],
  servingSize: 1,
  servingSizeUnit: 'cup',
}

const APPLE_FOOD = {
  id: '1750340',
  name: 'Apples, raw, with skin',
  brand: null,
  barcode: null,
  source: 'usda',
  sourceId: '1750340',
  per100g: {
    kcal: 52,
    protein: 0.26,
    carbs: 13.81,
    fat: 0.17,
    fiber: null,
    sugar: null,
    salt: 0.6,
  },
  serving: { grams: 100, label: '100 g' },
}

const PANE = {
  code: '8003170101142',
  product_name: 'PANE PROTEICO',
  brands: ['Piacersi Conad'],
  nutriments: { 'energy-kcal_100g': 260 },
}

function testEnv(usdaKey: string | undefined = USDA_KEY): Env {
  return {
    DB: createTestDatabase(),
    API_TOKEN: SERVICE_TOKEN,
    GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    ALLOWED_EMAIL: OWNER_EMAIL,
    USDA_API_KEY: usdaKey,
  } as unknown as Env
}

function call(env: Env, path: string) {
  return worker.fetch(
    new Request(`https://crumbs.test${path}`, {
      headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
    }),
    env,
  )
}

async function seedUser(env: Env): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, created_at) VALUES ('user-1', ?, 'Owner', '2026-01-01T00:00:00.000Z')",
  )
    .bind(OWNER_EMAIL)
    .run()
}

function stubUsda(body: unknown = { foods: [APPLE] }): void {
  fetchStub().intercept(/api\.nal\.usda\.gov/, () => Response.json(body))
}

function usdaRequests(): Request[] {
  return fetchStub().requests.filter((request) => request.url.includes('api.nal.usda.gov'))
}

function offRequests(): Request[] {
  return fetchStub().requests.filter((request) => request.url.includes('openfoodfacts.org'))
}

let env: Env

beforeEach(async () => {
  env = testEnv()
  await seedUser(env)
})

describe('USDA food search', () => {
  it('normalizes a food per 100 g, deriving salt from sodium and keeping absent nutrients null', async () => {
    stubUsda()

    const response = await call(env, '/api/foods/search?q=mela&source=usda')
    expect(response.status).toBe(200)

    const body = (await response.json()) as { off: unknown[]; usda: unknown[] }
    expect(body.off).toEqual([])
    expect(body.usda).toEqual([APPLE_FOOD])
  })

  it('prefers energy 208, falls back to 957 and reads sugar 269.3', async () => {
    stubUsda({ foods: [RICE] })

    const body = (await (await call(env, '/api/foods/search?q=riso&source=usda')).json()) as {
      usda: { per100g: Record<string, unknown>; serving: unknown }[]
    }

    expect(body.usda[0]!.per100g).toEqual({
      kcal: 999,
      protein: 2.69,
      carbs: null,
      fat: null,
      fiber: 0.4,
      sugar: 0.05,
      salt: null,
    })
    expect(body.usda[0]!.serving).toBeNull()
  })

  it('translates an italian query with the alias map', async () => {
    stubUsda()

    await call(env, '/api/foods/search?q=mela&source=usda')

    const url = new URL(usdaRequests()[0]!.url)
    expect(url.origin + url.pathname).toBe('https://api.nal.usda.gov/fdc/v1/foods/search')
    expect(url.searchParams.get('query')).toBe('apple')
    expect(url.searchParams.get('dataType')).toBe('Foundation,SR Legacy')
    expect(url.searchParams.get('pageSize')).toBe('20')
    expect(url.searchParams.get('api_key')).toBe(USDA_KEY)
  })

  it('passes an unmapped query through unchanged', async () => {
    stubUsda({ foods: [] })

    await call(env, '/api/foods/search?q=kombucha&source=usda')

    expect(new URL(usdaRequests()[0]!.url).searchParams.get('query')).toBe('kombucha')
  })

  it('returns a readable 503 when the key is not configured and calls no source', async () => {
    env = testEnv()
    delete (env as { USDA_API_KEY?: string }).USDA_API_KEY
    await seedUser(env)

    const response = await call(env, '/api/foods/search?q=mela&source=usda')

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'Alimenti semplici non configurati.',
      code: 'usda_not_configured',
    })
    expect(fetchStub().requests).toHaveLength(0)
  })

  it('queries only the selected source', async () => {
    stubUsda()
    fetchStub().intercept(/search\.openfoodfacts\.org/, () => Response.json({ hits: [PANE] }))

    const usdaBody = (await (await call(env, '/api/foods/search?q=pane&source=usda')).json()) as {
      off: unknown[]
      usda: unknown[]
    }
    expect(usdaBody.usda).toEqual([APPLE_FOOD])
    expect(usdaBody.off).toEqual([])
    expect(offRequests()).toHaveLength(0)

    const offBody = (await (await call(env, '/api/foods/search?q=pane&source=off')).json()) as {
      off: { name: string }[]
      usda: unknown[]
    }
    expect(offBody.off[0]!.name).toBe('PANE PROTEICO')
    expect(offBody.usda).toEqual([])
    expect(usdaRequests()).toHaveLength(1)
  })

  it('defaults to Open Food Facts when source is absent', async () => {
    fetchStub().intercept(/search\.openfoodfacts\.org/, () => Response.json({ hits: [PANE] }))

    const body = (await (await call(env, '/api/foods/search?q=pane')).json()) as {
      off: { name: string }[]
      usda: unknown[]
    }

    expect(body.off[0]!.name).toBe('PANE PROTEICO')
    expect(usdaRequests()).toHaveLength(0)
  })

  it('caches the trimmed response and reuses it for the same query', async () => {
    stubUsda()

    await call(env, '/api/foods/search?q=mela&source=usda')
    const second = await call(env, '/api/foods/search?q=MELA&source=usda')

    expect(second.status).toBe(200)
    expect(usdaRequests()).toHaveLength(1)

    const row = await env.DB.prepare('SELECT payload, source FROM api_cache WHERE key = ?')
      .bind('usda:search:apple')
      .first<{ payload: string; source: string }>()
    expect(row).not.toBeNull()
    expect(row!.source).toBe('usda')
    expect(row!.payload).not.toContain('foodNutrients')
    expect(JSON.parse(row!.payload)).toEqual([APPLE_FOOD])
  })

  it.each([429, 503])('serves stale cache when USDA answers %i', async (status) => {
    const stale = [{ ...APPLE_FOOD, name: 'Mela vecchia' }]
    await env.DB.prepare(
      "INSERT INTO api_cache (key, source, payload, fetched_at) VALUES ('usda:search:apple', 'usda', ?, '2020-01-01T00:00:00.000Z')",
    )
      .bind(JSON.stringify(stale))
      .run()
    fetchStub().intercept(/api\.nal\.usda\.gov/, () => new Response('limited', { status }))

    const response = await call(env, '/api/foods/search?q=mela&source=usda')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ off: [], usda: stale })
  })

  it('returns a readable error when USDA fails without cache', async () => {
    fetchStub().intercept(/api\.nal\.usda\.gov/, () => new Response('limited', { status: 429 }))

    const response = await call(env, '/api/foods/search?q=mela&source=usda')

    expect(response.status).toBe(503)
    const body = (await response.json()) as { error: string }
    expect(body.error).toContain('USDA')
    expect(body.error).toContain('Riprova')
  })

  it('rejects an unknown source', async () => {
    const response = await call(env, '/api/foods/search?q=mela&source=other')

    expect(response.status).toBe(400)
    expect(fetchStub().requests).toHaveLength(0)
  })
})
