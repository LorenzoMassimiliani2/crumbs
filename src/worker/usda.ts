import type { FoodSearchResponse, ItemNutrition, SearchFood } from '../lib/diary'
import type { Env } from './env'
import { translateUsdaQuery } from './usda-aliases'

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_RESULTS = 10

const ENERGY_IDS = [208, 957]
const PROTEIN_ID = 203
const CARBS_ID = 205
const FAT_ID = 204
const FIBER_ID = 291
const SUGAR_IDS = [269, 269.3]
const SODIUM_ID = 307
const SODIUM_TO_SALT = 0.0025

interface RawNutrient {
  nutrientId?: unknown
  amount?: unknown
}

interface RawFood {
  fdcId?: unknown
  description?: unknown
  foodNutrients?: unknown
  servingSize?: unknown
  servingSizeUnit?: unknown
}

interface CacheEntry {
  state: 'missing' | 'fresh' | 'stale'
  payload?: unknown
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

function nutrientMap(foodNutrients: unknown): Map<number, number> {
  const map = new Map<number, number>()
  if (!Array.isArray(foodNutrients)) return map
  for (const item of foodNutrients) {
    if (item === null || typeof item !== 'object') continue
    const nutrient = item as RawNutrient
    const id = numberOrNull(nutrient.nutrientId)
    const amount = numberOrNull(nutrient.amount)
    if (id === null || amount === null || map.has(id)) continue
    map.set(id, amount)
  }
  return map
}

function firstAmount(map: Map<number, number>, ids: number[]): number | null {
  for (const id of ids) {
    const amount = map.get(id)
    if (amount !== undefined) return amount
  }
  return null
}

function normalize(raw: RawFood): SearchFood | null {
  const fdcId = numberOrNull(raw.fdcId)
  const name = typeof raw.description === 'string' ? raw.description.trim() : ''
  if (fdcId === null || !name) return null

  const nutrients = nutrientMap(raw.foodNutrients)
  const energy = firstAmount(nutrients, ENERGY_IDS)
  if (energy === null) return null

  const protein = nutrients.get(PROTEIN_ID)
  const carbs = nutrients.get(CARBS_ID)
  const fat = nutrients.get(FAT_ID)
  const fiber = nutrients.get(FIBER_ID)
  const sugar = firstAmount(nutrients, SUGAR_IDS)
  const sodium = nutrients.get(SODIUM_ID)

  const per100g: ItemNutrition = {
    kcal: round(energy, 1),
    protein: protein === undefined ? null : round(protein, 2),
    carbs: carbs === undefined ? null : round(carbs, 2),
    fat: fat === undefined ? null : round(fat, 2),
    fiber: fiber === undefined ? null : round(fiber, 2),
    sugar: sugar === null ? null : round(sugar, 2),
    salt: sodium === undefined ? null : round(sodium * SODIUM_TO_SALT, 2),
  }

  const servingGrams = numberOrNull(raw.servingSize)
  const servingUnit = typeof raw.servingSizeUnit === 'string' ? raw.servingSizeUnit.trim() : ''
  const serving =
    servingGrams !== null && servingGrams > 0 && (servingUnit === '' || servingUnit.toLowerCase() === 'g')
      ? { grams: servingGrams, label: `${servingGrams} g` }
      : null

  const id = String(fdcId)
  return {
    id,
    name,
    brand: null,
    barcode: null,
    source: 'usda',
    sourceId: id,
    per100g,
    serving,
  }
}

async function readCache(env: Env, key: string): Promise<CacheEntry> {
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
  return { state: age <= SEARCH_TTL_MS ? 'fresh' : 'stale', payload }
}

async function writeCache(env: Env, key: string, payload: unknown): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO api_cache (key, source, payload, fetched_at)
     VALUES (?, 'usda', ?, ?)
     ON CONFLICT (key) DO UPDATE SET
       payload = excluded.payload,
       fetched_at = excluded.fetched_at`,
  )
    .bind(key, JSON.stringify(payload), new Date().toISOString())
    .run()
}

function respond(foods: SearchFood[]): Response {
  const body: FoodSearchResponse = { off: [], usda: foods }
  return Response.json(body)
}

function notConfigured(): Response {
  return Response.json(
    { error: 'Alimenti semplici non configurati.', code: 'usda_not_configured' },
    { status: 503 },
  )
}

function unavailable(): Response {
  return Response.json(
    { error: 'USDA FoodData Central non è disponibile. Riprova tra poco.' },
    { status: 503 },
  )
}

export async function searchUsdaFoods(query: string, env: Env): Promise<Response> {
  if (!env.USDA_API_KEY) return notConfigured()

  const translated = translateUsdaQuery(query)
  const key = `usda:search:${translated.toLowerCase().replace(/\s+/g, ' ')}`
  const cached = await readCache(env, key)
  if (cached.state === 'fresh') return respond(cached.payload as SearchFood[])

  const url = new URL(SEARCH_URL)
  url.searchParams.set('api_key', env.USDA_API_KEY)
  url.searchParams.set('query', translated)
  url.searchParams.set('dataType', 'Foundation,SR Legacy')
  url.searchParams.set('pageSize', '20')

  let foods: SearchFood[] = []
  try {
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`usda ${response.status}`)
    const payload = (await response.json()) as { foods?: unknown }
    const hits = Array.isArray(payload?.foods) ? payload.foods : []

    for (const hit of hits) {
      const food = normalize((hit ?? {}) as RawFood)
      if (food) foods.push(food)
      if (foods.length === MAX_RESULTS) break
    }
  } catch {
    if (cached.state === 'stale') return respond(cached.payload as SearchFood[])
    return unavailable()
  }

  await writeCache(env, key, foods)
  return respond(foods)
}
