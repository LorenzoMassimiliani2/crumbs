import type { FoodSearchResponse, ItemNutrition, SearchFood } from '../lib/diary'
import type { Env } from './env'

const SEARCH_URL = 'https://search.openfoodfacts.org/search'
const PRODUCT_URL = 'https://world.openfoodfacts.org/api'
const PRIMARY_PRODUCT_VERSION = 'v3.6'
const FALLBACK_PRODUCT_VERSION = 'v2'
const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000
const PRODUCT_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_RESULTS = 10
const MIN_QUERY_LENGTH = 3
const KJ_PER_KCAL = 4.184

const SEARCH_FIELDS = [
  'code',
  'product_name',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
].join(',')

const PRODUCT_FIELDS = SEARCH_FIELDS

type RawNutriments = Record<string, unknown>

interface RawProduct {
  code?: unknown
  product_name?: unknown
  brands?: unknown
  nutriments?: unknown
  serving_size?: unknown
  serving_quantity?: unknown
}

interface CacheEntry {
  state: 'missing' | 'fresh' | 'stale'
  payload?: unknown
}

function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    for (const key of ['it', 'en']) {
      const localized = text(record[key])
      if (localized) return localized
    }
    for (const candidate of Object.values(record)) {
      const localized = text(candidate)
      if (localized) return localized
    }
  }
  return null
}

function brandText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value.map(text).filter((part): part is string => part !== null)
    return parts.length > 0 ? parts.join(', ') : null
  }
  return text(value)
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function kcalOf(nutriments: RawNutriments): number | null {
  const kcal = numberOrNull(nutriments['energy-kcal_100g'])
  if (kcal !== null) return round(kcal, 1)

  const kj = numberOrNull(nutriments['energy-kj_100g'])
  if (kj !== null) return round(kj / KJ_PER_KCAL, 1)

  const energy = numberOrNull(nutriments['energy_100g'])
  if (energy !== null) return round(energy / KJ_PER_KCAL, 1)

  return null
}

function saltOf(nutriments: RawNutriments): number | null {
  const salt = numberOrNull(nutriments['salt_100g'])
  if (salt !== null) return round(salt, 2)

  const sodium = numberOrNull(nutriments['sodium_100g'])
  if (sodium !== null) return round(sodium * 2.5, 2)

  return null
}

function normalize(raw: RawProduct): SearchFood | null {
  const code = text(raw.code)
  const name = text(raw.product_name)
  if (!code || !name) return null

  const source = raw.nutriments
  const nutriments: RawNutriments =
    source !== null && typeof source === 'object' ? (source as RawNutriments) : {}
  const kcal = kcalOf(nutriments)
  const protein = numberOrNull(nutriments['proteins_100g'])
  const carbs = numberOrNull(nutriments['carbohydrates_100g'])
  const fat = numberOrNull(nutriments['fat_100g'])
  if (kcal === null || protein === null || carbs === null || fat === null) return null

  const per100g: ItemNutrition = {
    kcal,
    protein,
    carbs,
    fat,
    fiber: numberOrNull(nutriments['fiber_100g']),
    sugar: numberOrNull(nutriments['sugars_100g']),
    salt: saltOf(nutriments),
  }

  const servingGrams = numberOrNull(raw.serving_quantity)
  const servingLabel = text(raw.serving_size)
  const serving =
    servingGrams !== null && servingGrams > 0
      ? { grams: servingGrams, label: servingLabel ?? `${servingGrams} g` }
      : null

  return {
    id: code,
    name,
    brand: brandText(raw.brands),
    barcode: code,
    source: 'off',
    sourceId: code,
    per100g,
    serving,
  }
}

function userAgent(env: Env): string {
  return `Crumbs/0.1 (${env.ALLOWED_EMAIL})`
}

async function readCache(env: Env, key: string, ttlMs: number): Promise<CacheEntry> {
  const row = await env.DB.prepare('SELECT payload, fetched_at FROM api_cache WHERE key = ?')
    .bind(key)
    .first<{ payload: string; fetched_at: string }>()
  if (!row) return { state: 'missing' }

  let payload: unknown
  try {
    payload = JSON.parse(row.payload)
  } catch {
    return { state: 'missing' }
  }

  const age = Date.now() - Date.parse(row.fetched_at)
  if (!Number.isFinite(age) || age < 0) return { state: 'stale', payload }
  return { state: age <= ttlMs ? 'fresh' : 'stale', payload }
}

async function writeCache(env: Env, key: string, payload: unknown): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO api_cache (key, source, payload, fetched_at)
     VALUES (?, 'off', ?, ?)
     ON CONFLICT (key) DO UPDATE SET
       payload = excluded.payload,
       fetched_at = excluded.fetched_at`,
  )
    .bind(key, JSON.stringify(payload), new Date().toISOString())
    .run()
}

function unavailable(): Response {
  return Response.json(
    { error: 'Open Food Facts non è disponibile. Riprova tra poco.' },
    { status: 503 },
  )
}

function notFound(): Response {
  return Response.json({ error: 'Prodotto non trovato.' }, { status: 404 })
}

async function fetchJson(url: string, env: Env): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent(env), Accept: 'application/json' },
  })
  const body = response.ok ? await response.json() : null
  return { response, body }
}

export async function searchFoods(request: Request, env: Env): Promise<Response> {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (q.length < MIN_QUERY_LENGTH) {
    const empty: FoodSearchResponse = { off: [], usda: [] }
    return Response.json(empty)
  }

  const key = `off:search:${q.toLowerCase()}`
  const cached = await readCache(env, key, SEARCH_TTL_MS)
  if (cached.state === 'fresh') {
    const body: FoodSearchResponse = { off: cached.payload as SearchFood[], usda: [] }
    return Response.json(body)
  }

  const url = new URL(SEARCH_URL)
  url.searchParams.set('q', q)
  url.searchParams.set('langs', 'it,en')
  url.searchParams.set('page_size', '20')
  url.searchParams.set('fields', SEARCH_FIELDS)

  let hits: unknown[] = []
  try {
    const { response, body } = await fetchJson(url.toString(), env)
    if (!response.ok) throw new Error(`open food facts ${response.status}`)
    const payload = body as { hits?: unknown }
    hits = Array.isArray(payload?.hits) ? payload.hits : []
  } catch {
    if (cached.state === 'stale') {
      const body: FoodSearchResponse = { off: cached.payload as SearchFood[], usda: [] }
      return Response.json(body)
    }
    return unavailable()
  }

  const foods: SearchFood[] = []
  for (const hit of hits) {
    const food = normalize((hit ?? {}) as RawProduct)
    if (food) foods.push(food)
    if (foods.length === MAX_RESULTS) break
  }

  await writeCache(env, key, foods)
  const body: FoodSearchResponse = { off: foods, usda: [] }
  return Response.json(body)
}

type FoodResult =
  | { kind: 'ok'; food: SearchFood | null }
  | { kind: 'not_found' }
  | { kind: 'unavailable' }

interface ProductResult {
  kind: 'ok' | 'not_found' | 'unavailable'
  product?: RawProduct
}

async function fetchProduct(
  env: Env,
  code: string,
  version: string,
): Promise<ProductResult> {
  const url = new URL(`${PRODUCT_URL}/${version}/product/${code}.json`)
  url.searchParams.set('fields', PRODUCT_FIELDS)

  try {
    const { response, body } = await fetchJson(url.toString(), env)
    if (response.status === 404) return { kind: 'not_found' }
    if (!response.ok) return { kind: 'unavailable' }
    const payload = body as { product?: RawProduct }
    return payload?.product ? { kind: 'ok', product: payload.product } : { kind: 'not_found' }
  } catch {
    return { kind: 'unavailable' }
  }
}

/**
 * v3.6 currently answers with an empty `nutriments` object for some products.
 * When its payload has no usable nutrition, read the same product once more
 * from v2, whose response still carries the nutrient values.
 */
async function readProduct(env: Env, code: string): Promise<FoodResult> {
  const primary = await fetchProduct(env, code, PRIMARY_PRODUCT_VERSION)
  if (primary.kind === 'not_found') return { kind: 'not_found' }
  if (primary.kind === 'unavailable') return { kind: 'unavailable' }

  const direct = normalize(primary.product!)
  if (direct) return { kind: 'ok', food: direct }

  const fallback = await fetchProduct(env, code, FALLBACK_PRODUCT_VERSION)
  if (fallback.kind === 'ok') {
    const food = normalize(fallback.product!)
    if (food) return { kind: 'ok', food }
  }
  if (fallback.kind === 'unavailable') return { kind: 'unavailable' }

  return { kind: 'ok', food: null }
}

export async function getOffProduct(env: Env, code: string): Promise<Response> {
  if (!/^\d{6,14}$/.test(code)) {
    return Response.json({ error: 'Codice a barre non valido.' }, { status: 400 })
  }

  const key = `off:product:${code}`
  const cached = await readCache(env, key, PRODUCT_TTL_MS)
  if (cached.state === 'fresh') return Response.json(cached.payload)

  const result = await readProduct(env, code)

  if (result.kind === 'not_found') return notFound()
  if (result.kind === 'unavailable') {
    if (cached.state === 'stale') return Response.json(cached.payload)
    return unavailable()
  }

  if (!result.food) {
    return Response.json(
      { error: 'Il prodotto non ha valori nutrizionali utilizzabili.' },
      { status: 422 },
    )
  }

  await writeCache(env, key, result.food)
  return Response.json(result.food)
}
