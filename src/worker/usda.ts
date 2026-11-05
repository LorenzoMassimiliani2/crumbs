import type { FoodSearchResponse, ItemNutrition, SearchFood } from '../lib/diary'
import type { Env } from './env'
import { translateUsdaQuery } from './usda-aliases'

const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_RESULTS = 10

interface NutrientSpec {
  /** Legacy nutrient numbers, as returned in `nutrientNumber` by the search endpoint. */
  numbers: string[]
  /** Numeric ids, for food-detail payloads and older fixtures. */
  ids: number[]
}

const ENERGY_KCAL: NutrientSpec = { numbers: ['208', '957'], ids: [1008, 2047, 208, 957] }
const ENERGY_KJ: NutrientSpec = { numbers: ['268'], ids: [1062, 268] }
const PROTEIN: NutrientSpec = { numbers: ['203'], ids: [1003, 203] }
const CARBS: NutrientSpec = { numbers: ['205'], ids: [1005, 205] }
const FAT: NutrientSpec = { numbers: ['204'], ids: [1004, 204] }
const FIBER: NutrientSpec = { numbers: ['291'], ids: [1079, 291] }
const SUGAR: NutrientSpec = { numbers: ['269', '269.3'], ids: [2000, 269, 269.3] }
const SODIUM: NutrientSpec = { numbers: ['307'], ids: [1093, 307] }
const SODIUM_TO_SALT = 0.0025

interface RawNutrient {
  nutrientId?: unknown
  /** Legacy number, e.g. "208". The search endpoint returns it; the detail endpoint nests it under nutrient.number. */
  nutrientNumber?: unknown
  /** The search endpoint returns `value`; the food-detail endpoint returns `amount`. */
  value?: unknown
  amount?: unknown
}

interface NutrientIndex {
  byNumber: Map<string, number>
  byId: Map<number, number>
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

function nutrientMap(foodNutrients: unknown): NutrientIndex {
  const byNumber = new Map<string, number>()
  const byId = new Map<number, number>()
  if (!Array.isArray(foodNutrients)) return { byNumber, byId }
  for (const item of foodNutrients) {
    if (item === null || typeof item !== 'object') continue
    const nutrient = item as RawNutrient
    const id = numberOrNull(nutrient.nutrientId)
    const rawNumber = nutrient.nutrientNumber
    const number =
      typeof rawNumber === 'string'
        ? rawNumber.trim()
        : typeof rawNumber === 'number'
          ? String(rawNumber)
          : null
    const amount = numberOrNull(nutrient.value ?? nutrient.amount)
    if (amount === null) continue
    if (number !== null && number !== '' && !byNumber.has(number)) byNumber.set(number, amount)
    if (id !== null && !byId.has(id)) byId.set(id, amount)
  }
  return { byNumber, byId }
}

function nutrientAmount(nutrients: NutrientIndex, spec: NutrientSpec): number | null {
  for (const number of spec.numbers) {
    const amount = nutrients.byNumber.get(number)
    if (amount !== undefined) return amount
  }
  for (const id of spec.ids) {
    const amount = nutrients.byId.get(id)
    if (amount !== undefined) return amount
  }
  return null
}

function normalize(raw: RawFood): SearchFood | null {
  const fdcId = numberOrNull(raw.fdcId)
  const name = typeof raw.description === 'string' ? raw.description.trim() : ''
  if (fdcId === null || !name) return null

  const nutrients = nutrientMap(raw.foodNutrients)
  const energyKcal = nutrientAmount(nutrients, ENERGY_KCAL)
  const energyKj = nutrientAmount(nutrients, ENERGY_KJ)
  const energy = energyKcal ?? (energyKj === null ? null : energyKj / 4.184)
  if (energy === null) return null

  const protein = nutrientAmount(nutrients, PROTEIN)
  const carbs = nutrientAmount(nutrients, CARBS)
  const fat = nutrientAmount(nutrients, FAT)
  const fiber = nutrientAmount(nutrients, FIBER)
  const sugar = nutrientAmount(nutrients, SUGAR)
  const sodium = nutrientAmount(nutrients, SODIUM)

  const per100g: ItemNutrition = {
    kcal: round(energy, 1),
    protein: protein === null ? null : round(protein, 2),
    carbs: carbs === null ? null : round(carbs, 2),
    fat: fat === null ? null : round(fat, 2),
    fiber: fiber === null ? null : round(fiber, 2),
    sugar: sugar === null ? null : round(sugar, 2),
    salt: sodium === null ? null : round(sodium * SODIUM_TO_SALT, 2),
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


const PROCESSED_TERMS = [
  'dried', 'juice', 'babyfood', 'canned', 'frozen', 'croissant', 'strudel',
  'pie', 'sauce', 'sweetened', 'candied', 'dehydrated', 'powder',
]

function relevance(food: SearchFood, query: string): number {
  const name = food.name.toLowerCase()
  const needle = query.toLowerCase().trim()
  let score = name.split(/[,\s]+/).filter(Boolean).length
  if (name.startsWith(needle)) score -= 100
  else if (name.includes(needle)) score -= 20
  if (name.includes('raw')) score -= 10
  if (PROCESSED_TERMS.some((term) => name.includes(term))) score += 25
  return score
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
  const key = `usda:search:v4:${translated.toLowerCase().replace(/\s+/g, ' ')}`
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
    }
    foods.sort((a, b) => relevance(a, translated) - relevance(b, translated))
    foods = foods.slice(0, MAX_RESULTS)
  } catch {
    if (cached.state === 'stale') return respond(cached.payload as SearchFood[])
    return unavailable()
  }

  await writeCache(env, key, foods)
  return respond(foods)
}
