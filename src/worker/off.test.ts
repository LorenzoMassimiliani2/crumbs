import { beforeEach, describe, expect, it } from 'vitest'

import { fetchStub } from '@/test/fetch'
import { createTestDatabase } from '@/test/d1'
import type { Env } from './env'
import worker from './index'

const OWNER_EMAIL = 'owner@example.com'
const SERVICE_TOKEN = 'test-service-token'

const PANE_HIT = {
  code: '8003170101142',
  product_name: 'PANE PROTEICO',
  brands: ['Piacersi Conad'],
  nutriments: {
    'energy-kcal_100g': 260,
    'energy-kj_100g': 1089,
    proteins_100g: 14,
    carbohydrates_100g: 37,
    fat_100g: 4.8,
    fiber_100g: 6.5,
    sugars_100g: 4.9,
    salt_100g: 0.99,
  },
  serving_size: '23.5g',
  serving_quantity: 23.5,
}

const KJ_HIT = {
  code: '221',
  product_name: 'Biscotti secchi',
  brands: 'Marca Test',
  nutriments: {
    'energy-kj_100g': 418.4,
    proteins_100g: 5,
    carbohydrates_100g: 60,
    fat_100g: 10,
    sodium_100g: 0.2,
    sugars_100g: 0,
  },
}

const PANE_PER_100G = {
  kcal: 260,
  protein: 14,
  carbs: 37,
  fat: 4.8,
  fiber: 6.5,
  sugar: 4.9,
  salt: 0.99,
}

function withoutKcal(index: number) {
  return {
    code: `700${index}`,
    product_name: `Senza valori ${index}`,
    brands: 'Marca',
    nutriments: { proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 },
  }
}

function searchHits() {
  return [
    PANE_HIT,
    ...Array.from({ length: 12 }, (_, index) => ({
      code: `600${index}`,
      product_name: `Prodotto ${index}`,
      brands: ['Marca'],
      nutriments: {
        'energy-kcal_100g': 100 + index,
        proteins_100g: 1,
        carbohydrates_100g: 1,
        fat_100g: 1,
      },
    })),
    withoutKcal(1),
  ]
}

function testEnv(): Env {
  return {
    DB: createTestDatabase(),
    API_TOKEN: SERVICE_TOKEN,
    GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    ALLOWED_EMAIL: OWNER_EMAIL,
  } as unknown as Env
}

function call(env: Env, path: string, token = SERVICE_TOKEN) {
  return worker.fetch(
    new Request(`https://crumbs.test${path}`, {
      headers: { Authorization: `Bearer ${token}` },
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

function stubSearch(body: unknown = { hits: searchHits() }): void {
  fetchStub().intercept(/search\.openfoodfacts\.org/, () => Response.json(body))
}

let env: Env

beforeEach(async () => {
  env = testEnv()
  await seedUser(env)
})

describe('GET /api/foods/search', () => {
  it('does not call Open Food Facts for a query shorter than 3 characters', async () => {
    const response = await call(env, '/api/foods/search?q=pa')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ off: [], usda: [] })
    expect(fetchStub().requests).toHaveLength(0)
  })

  it('normalizes products, drops those without kcal and keeps at most 10', async () => {
    stubSearch()

    const response = await call(env, '/api/foods/search?q=pane')
    expect(response.status).toBe(200)

    const body = (await response.json()) as { off: Record<string, unknown>[]; usda: unknown[] }
    expect(body.usda).toEqual([])
    expect(body.off).toHaveLength(10)

    expect(body.off[0]).toEqual({
      id: '8003170101142',
      name: 'PANE PROTEICO',
      brand: 'Piacersi Conad',
      barcode: '8003170101142',
      source: 'off',
      sourceId: '8003170101142',
      per100g: PANE_PER_100G,
      serving: { grams: 23.5, label: '23.5g' },
    })

    expect(body.off.some((food) => food.name === 'Senza valori 1')).toBe(false)
    for (const food of body.off) {
      expect((food.per100g as { kcal: number }).kcal).toEqual(expect.any(Number))
    }
  })

  it('derives kcal from kJ, salt from sodium and keeps absent nutrients null', async () => {
    stubSearch({ hits: [KJ_HIT] })

    const body = (await (await call(env, '/api/foods/search?q=biscotti')).json()) as {
      off: { per100g: Record<string, unknown> }[]
    }

    expect(body.off[0]!.per100g).toEqual({
      kcal: 100,
      protein: 5,
      carbs: 60,
      fat: 10,
      fiber: null,
      sugar: 0,
      salt: 0.5,
    })
  })

  it('keeps a result with kcal even when the macros are missing', async () => {
    stubSearch({
      hits: [
        {
          code: '999',
          product_name: 'Solo kcal',
          brands: ['Marca'],
          nutriments: { 'energy-kcal_100g': 100 },
        },
        KJ_HIT,
      ],
    })

    const body = (await (await call(env, '/api/foods/search?q=biscotti')).json()) as {
      off: { name: string; per100g: Record<string, unknown> }[]
    }

    expect(body.off.map((food) => food.name)).toEqual(['Solo kcal', 'Biscotti secchi'])
    expect(body.off[0]!.per100g).toEqual({
      kcal: 100,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      salt: null,
    })
  })

  it('sends the app user agent and explicit query fields to the source', async () => {
    stubSearch()

    await call(env, '/api/foods/search?q=pane')

    const request = fetchStub().requests.find((item) =>
      item.url.includes('search.openfoodfacts.org'),
    )!
    expect(request.headers.get('user-agent')).toBe(`Crumbs/0.1 (${OWNER_EMAIL})`)

    const url = new URL(request.url)
    expect(url.searchParams.get('q')).toBe('pane')
    expect(url.searchParams.get('langs')).toBe('it,en')
    expect(url.searchParams.get('fields')).toContain('nutriments')
    expect(url.searchParams.get('fields')).not.toContain('debug')
  })

  it('serves a repeated query from the cache without calling the source', async () => {
    stubSearch()

    await call(env, '/api/foods/search?q=pane')
    const second = await call(env, '/api/foods/search?q=PANE')

    expect(second.status).toBe(200)
    const offRequests = fetchStub().requests.filter((item) =>
      item.url.includes('search.openfoodfacts.org'),
    )
    expect(offRequests).toHaveLength(1)

    const row = await env.DB.prepare("SELECT payload FROM api_cache WHERE key = ?")
      .bind('off:search:pane')
      .first<{ payload: string }>()
    expect(row).not.toBeNull()
    expect(row!.payload).not.toContain('nutriments')
    expect(row!.payload).not.toContain('debug')
    expect(JSON.parse(row!.payload)[0]).toMatchObject({ sourceId: '8003170101142' })
  })

  it('serves stale cache data when Open Food Facts answers 429', async () => {
    const stale = [
      {
        id: 'old',
        name: 'Pane vecchio',
        brand: null,
        barcode: 'old',
        source: 'off',
        sourceId: 'old',
        per100g: { ...PANE_PER_100G, kcal: 1 },
        serving: null,
      },
    ]
    await env.DB.prepare(
      "INSERT INTO api_cache (key, source, payload, fetched_at) VALUES ('off:search:pane', 'off', ?, '2020-01-01T00:00:00.000Z')",
    )
      .bind(JSON.stringify(stale))
      .run()
    fetchStub().intercept(/search\.openfoodfacts\.org/, () => new Response('rate limited', { status: 429 }))

    const response = await call(env, '/api/foods/search?q=pane')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ off: stale, usda: [] })
  })

  it('returns a readable error on 429 without any cache', async () => {
    fetchStub().intercept(/search\.openfoodfacts\.org/, () => new Response('rate limited', { status: 429 }))

    const response = await call(env, '/api/foods/search?q=pane')

    expect(response.status).toBe(503)
    const body = (await response.json()) as { error: string }
    expect(body.error).toContain('Open Food Facts')
    expect(body.error).toContain('Riprova')
  })

  it('requires a credential', async () => {
    const response = await worker.fetch(
      new Request('https://crumbs.test/api/foods/search?q=pane'),
      env,
    )
    expect(response.status).toBe(401)
  })
})

describe('GET /api/foods/off/:code', () => {
  const PRODUCT_BODY = {
    code: '8003170101142',
    status: 'success',
    product: {
      code: '8003170101142',
      product_name: 'PANE PROTEICO',
      brands: 'Piacersi Conad',
      nutriments: PANE_HIT.nutriments,
      serving_size: '23.5g',
      serving_quantity: 23.5,
    },
  }

  function stubProduct(body: unknown = PRODUCT_BODY): void {
    fetchStub().intercept(/world\.openfoodfacts\.org\/api\/v3\.6\/product\//, () =>
      Response.json(body),
    )
  }

  it('fetches and normalizes the current product', async () => {
    stubProduct()

    const response = await call(env, '/api/foods/off/8003170101142')
    expect(response.status).toBe(200)

    expect(await response.json()).toEqual({
      id: '8003170101142',
      name: 'PANE PROTEICO',
      brand: 'Piacersi Conad',
      barcode: '8003170101142',
      source: 'off',
      sourceId: '8003170101142',
      per100g: PANE_PER_100G,
      serving: { grams: 23.5, label: '23.5g' },
    })

    const request = fetchStub().requests[0]!
    expect(request.url).toContain('/api/v3.6/product/8003170101142.json')
    expect(request.headers.get('user-agent')).toBe(`Crumbs/0.1 (${OWNER_EMAIL})`)
  })

  it('derives salt from sodium when the product has no salt', async () => {
    stubProduct({
      code: '000221',
      status: 'success',
      product: {
        code: '000221',
        product_name: 'Biscotti secchi',
        brands: 'Marca Test',
        nutriments: KJ_HIT.nutriments,
      },
    })

    const body = (await (await call(env, '/api/foods/off/000221')).json()) as {
      per100g: Record<string, unknown>
    }
    expect(body.per100g).toMatchObject({ kcal: 100, salt: 0.5, carbs: 60, fiber: null })
  })

  it('falls back to v2 when v3.6 returns empty nutrition', async () => {
    fetchStub().intercept(/v3\.6\/product\//, () =>
      Response.json({
        code: '8003170101142',
        status: 'success',
        product: {
          code: '8003170101142',
          product_name: 'PANE PROTEICO',
          brands: 'Piacersi Conad',
          nutriments: {},
        },
      }),
    )
    fetchStub().intercept(/\/v2\/product\//, () => Response.json({ ...PRODUCT_BODY, status: 1 }))

    const response = await call(env, '/api/foods/off/8003170101142')

    expect(response.status).toBe(200)
    const body = (await response.json()) as { per100g: unknown }
    expect(body.per100g).toEqual(PANE_PER_100G)

    const versions = fetchStub().requests
      .filter((request) => request.url.includes('/product/'))
      .map((request) => (request.url.includes('/v2/') ? 'v2' : 'v3.6'))
    expect(versions).toEqual(['v3.6', 'v2'])
  })

  it('does not call v2 when v3.6 already has nutrition', async () => {
    stubProduct()

    await call(env, '/api/foods/off/8003170101142')

    expect(fetchStub().requests.filter((request) => request.url.includes('/v2/'))).toHaveLength(0)
  })

  it('caches the product and reuses it on the next call', async () => {
    stubProduct()

    await call(env, '/api/foods/off/8003170101142')
    const cached = await call(env, '/api/foods/off/8003170101142')

    expect(cached.status).toBe(200)
    const productRequests = fetchStub().requests.filter((item) =>
      item.url.includes('world.openfoodfacts.org'),
    )
    expect(productRequests).toHaveLength(1)
  })

  it('returns 404 for an unknown product', async () => {
    fetchStub().intercept(/world\.openfoodfacts\.org/, () => new Response('not found', { status: 404 }))

    const response = await call(env, '/api/foods/off/9999999999999')

    expect(response.status).toBe(404)
    expect((await response.json()) as { error: string }).toEqual({
      error: 'Prodotto non trovato.',
    })
  })

  it('serves a stale product when the source answers 503', async () => {
    const stale = {
      id: 'old',
      name: 'Pane vecchio',
      brand: null,
      barcode: 'old',
      source: 'off',
      sourceId: 'old',
      per100g: PANE_PER_100G,
      serving: null,
    }
    await env.DB.prepare(
      "INSERT INTO api_cache (key, source, payload, fetched_at) VALUES ('off:product:1111111111111', 'off', ?, '2020-01-01T00:00:00.000Z')",
    )
      .bind(JSON.stringify(stale))
      .run()
    fetchStub().intercept(/world\.openfoodfacts\.org/, () => new Response('down', { status: 503 }))

    const response = await call(env, '/api/foods/off/1111111111111')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(stale)
  })

  it('rejects an invalid barcode without calling the source', async () => {
    const response = await call(env, '/api/foods/off/not-a-code')

    expect(response.status).toBe(400)
    expect(fetchStub().requests).toHaveLength(0)
  })
})
