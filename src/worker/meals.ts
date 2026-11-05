import {
  itemTotals,
  sumTotals,
  type DayItem,
  type DayMeal,
  type Food,
  type FoodSource,
  type ItemNutrition,
} from '../lib/diary'
import { isMealType, type MealType } from '../lib/meal-types'
import type { Env } from './env'

const MAX_ITEMS = 50
const MAX_GRAMS = 5000
const SOURCES: readonly FoodSource[] = ['off', 'usda', 'manual']

export interface MealItemInput {
  name: string
  source: FoodSource
  sourceId: string | null
  brand: string | null
  grams: number
  per100g: ItemNutrition
}

export interface MealFields {
  occurredAt: string | null
  localDate: string | null
  type: MealType
  note: string | null
  items: MealItemInput[]
}

export type ParsedMeal = { ok: true; value: MealFields } | { ok: false; error: string }

function isRealDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Accepts an ISO instant and normalizes it to UTC; a missing zone is rejected. */
function toUtcInstant(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null
  }
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

function toNonNegative(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

/** An omitted or explicit null nutrient stays unknown; undefined means malformed. */
function optionalNutrient(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null
  return toNonNegative(value) ?? undefined
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.length <= maxLength ? trimmed : undefined
}

function parseItem(value: unknown): MealItemInput | string {
  if (value === null || typeof value !== 'object') return 'Una voce non è valida.'
  const input = value as Record<string, unknown>

  const name = optionalText(input.name, 120)
  if (!name) return "Il nome dell'alimento è obbligatorio."

  const source = input.source
  if (!SOURCES.includes(source as FoodSource)) return "La fonte dell'alimento non è valida."

  const sourceId = optionalText(input.sourceId, 200)
  if (sourceId === undefined) return "L'identificativo esterno non è valido."

  const brand = optionalText(input.brand, 120)
  if (brand === undefined) return 'La marca non è valida.'

  const grams = toNonNegative(input.grams)
  if (grams === null || grams === 0 || grams > MAX_GRAMS) {
    return `I grammi devono essere maggiori di 0 e al massimo ${MAX_GRAMS}.`
  }

  if (input.per100g === null || typeof input.per100g !== 'object') {
    return 'I valori per 100 g non sono validi.'
  }
  const per100g = input.per100g as Record<string, unknown>
  const kcal = toNonNegative(per100g.kcal)
  const protein = toNonNegative(per100g.protein)
  const carbs = toNonNegative(per100g.carbs)
  const fat = toNonNegative(per100g.fat)
  const fiber = optionalNutrient(per100g.fiber)
  const sugar = optionalNutrient(per100g.sugar)
  const salt = optionalNutrient(per100g.salt)
  if (
    kcal === null ||
    protein === null ||
    carbs === null ||
    fat === null ||
    fiber === undefined ||
    sugar === undefined ||
    salt === undefined
  ) {
    return 'I valori per 100 g devono essere numeri non negativi.'
  }

  return {
    name,
    source: source as FoodSource,
    sourceId,
    brand,
    grams,
    per100g: { kcal, protein, carbs, fat, fiber, sugar, salt },
  }
}

export function parseMealInput(body: unknown, requireTiming: boolean): ParsedMeal {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Richiesta non valida.' }
  }
  const input = body as Record<string, unknown>

  const type = input.type
  if (!isMealType(type)) return { ok: false, error: 'Il tipo di pasto non è valido.' }

  const note = optionalText(input.note, 500)
  if (note === undefined) return { ok: false, error: 'La nota non è valida.' }

  let occurredAt: string | null = null
  let localDate: string | null = null
  if (requireTiming) {
    occurredAt = toUtcInstant(input.occurredAt)
    if (occurredAt === null) return { ok: false, error: "L'orario del pasto non è valido." }
    if (!isRealDate(input.localDate)) return { ok: false, error: 'La data locale non è valida.' }
    localDate = input.localDate
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: 'Il pasto deve contenere almeno un alimento.' }
  }
  if (input.items.length > MAX_ITEMS) {
    return { ok: false, error: `Il pasto può contenere al massimo ${MAX_ITEMS} alimenti.` }
  }

  const items: MealItemInput[] = []
  for (const raw of input.items) {
    const parsed = parseItem(raw)
    if (typeof parsed === 'string') return { ok: false, error: parsed }
    items.push(parsed)
  }

  return { ok: true, value: { occurredAt, localDate, type, note, items } }
}

interface Favorite {
  id: string
  exists: boolean
}

async function resolveFavorites(
  env: Env,
  userId: string,
  items: MealItemInput[],
): Promise<Favorite[]> {
  const resolved: Favorite[] = []
  const seen = new Map<string, Favorite>()

  for (const item of items) {
    const key = item.sourceId
      ? `${item.source}:${item.sourceId}`
      : `name:${item.name.trim().toLowerCase()}`

    const already = seen.get(key)
    if (already) {
      resolved.push(already)
      continue
    }

    const row = item.sourceId
      ? await env.DB.prepare(
          'SELECT id FROM foods WHERE user_id = ? AND source = ? AND source_id = ?',
        )
          .bind(userId, item.source, item.sourceId)
          .first<{ id: string }>()
      : await env.DB.prepare(
          'SELECT id FROM foods WHERE user_id = ? AND source_id IS NULL AND lower(trim(name)) = ?',
        )
          .bind(userId, item.name.trim().toLowerCase())
          .first<{ id: string }>()

    const favorite: Favorite = { id: row?.id ?? crypto.randomUUID(), exists: row !== null }
    seen.set(key, favorite)
    resolved.push(favorite)
  }

  return resolved
}

/** Favorites keep numeric columns, so an unknown nutrient is stored as 0. */
function favoriteNutritionValues(item: MealItemInput): number[] {
  return [
    item.per100g.kcal,
    item.per100g.protein,
    item.per100g.carbs,
    item.per100g.fat,
    item.per100g.fiber ?? 0,
    item.per100g.sugar ?? 0,
    item.per100g.salt ?? 0,
  ]
}

function itemNutritionValues(item: MealItemInput): (number | null)[] {
  return [
    item.per100g.kcal,
    item.per100g.protein,
    item.per100g.carbs,
    item.per100g.fat,
    item.per100g.fiber,
    item.per100g.sugar,
    item.per100g.salt,
  ]
}

function favoriteStatement(
  env: Env,
  userId: string,
  item: MealItemInput,
  favorite: Favorite,
  now: string,
): D1PreparedStatement {
  if (favorite.exists) {
    return env.DB.prepare(
      `UPDATE foods SET
         name = ?, brand = ?,
         kcal_100g = ?, protein_100g = ?, carbs_100g = ?, fat_100g = ?,
         fiber_100g = ?, sugar_100g = ?, salt_100g = ?,
         last_used_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).bind(item.name, item.brand, ...favoriteNutritionValues(item), now, now, favorite.id, userId)
  }

  return env.DB.prepare(
    `INSERT INTO foods
       (id, user_id, name, brand, source, source_id,
        kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, salt_100g,
        last_used_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    favorite.id,
    userId,
    item.name,
    item.brand,
    item.source,
    item.sourceId,
    ...favoriteNutritionValues(item),
    now,
    now,
    now,
  )
}

function itemStatement(
  env: Env,
  mealId: string,
  itemId: string,
  item: MealItemInput,
  favorite: Favorite,
  position: number,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO meal_items
       (id, meal_id, food_id, name_snapshot, source, brand, source_id,
        kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, salt_100g,
        grams, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    itemId,
    mealId,
    favorite.id,
    item.name,
    item.source,
    item.brand,
    item.sourceId,
    ...itemNutritionValues(item),
    item.grams,
    position,
  )
}

function inputItem(input: MealItemInput, id: string): DayItem {
  return {
    id,
    name: input.name,
    source: input.source,
    brand: input.brand,
    sourceId: input.sourceId,
    grams: input.grams,
    per100g: input.per100g,
    totals: itemTotals(input.per100g, input.grams),
  }
}

function mealPayload(
  id: string,
  input: MealFields,
  occurredAt: string,
  localDate: string,
  itemIds: string[],
): DayMeal {
  const items = input.items.map((item, index) => inputItem(item, itemIds[index]!))
  return {
    id,
    type: input.type,
    occurredAt,
    localDate,
    note: input.note,
    totals: sumTotals(items.map((item) => item.totals)),
    items,
  }
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 })
}

function notFound(): Response {
  return Response.json({ error: 'Pasto non trovato.' }, { status: 404 })
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

interface MealRow {
  id: string
  meal_type: string
  occurred_at: string
  local_date: string
  note: string | null
}

interface ItemRow {
  id: string
  meal_id: string
  name_snapshot: string
  source: string
  brand: string | null
  source_id: string | null
  grams: number
  kcal_100g: number
  protein_100g: number
  carbs_100g: number
  fat_100g: number
  fiber_100g: number | null
  sugar_100g: number | null
  salt_100g: number | null
}

export async function getDay(env: Env, userId: string, date: string): Promise<Response> {
  if (!isRealDate(date)) return badRequest('Data non valida.')

  const profile = await env.DB.prepare('SELECT target_kcal FROM profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ target_kcal: number }>()

  const mealRows = await env.DB.prepare(
    `SELECT id, meal_type, occurred_at, local_date, note
     FROM meals
     WHERE user_id = ? AND local_date = ? AND deleted_at IS NULL
     ORDER BY occurred_at ASC, id ASC`,
  )
    .bind(userId, date)
    .all<MealRow>()

  const itemRows = await env.DB.prepare(
    `SELECT mi.id, mi.meal_id, mi.name_snapshot, mi.source, mi.brand, mi.source_id, mi.grams,
            mi.kcal_100g, mi.protein_100g, mi.carbs_100g, mi.fat_100g,
            mi.fiber_100g, mi.sugar_100g, mi.salt_100g
     FROM meal_items mi
     JOIN meals m ON m.id = mi.meal_id
     WHERE m.user_id = ? AND m.local_date = ? AND m.deleted_at IS NULL
     ORDER BY mi.position ASC`,
  )
    .bind(userId, date)
    .all<ItemRow>()

  const itemsByMeal = new Map<string, DayItem[]>()
  for (const row of itemRows.results) {
    const per100g: ItemNutrition = {
      kcal: row.kcal_100g,
      protein: row.protein_100g,
      carbs: row.carbs_100g,
      fat: row.fat_100g,
      fiber: row.fiber_100g,
      sugar: row.sugar_100g,
      salt: row.salt_100g,
    }
    const items = itemsByMeal.get(row.meal_id) ?? []
    items.push({
      id: row.id,
      name: row.name_snapshot,
      source: row.source as FoodSource,
      brand: row.brand,
      sourceId: row.source_id,
      grams: row.grams,
      per100g,
      totals: itemTotals(per100g, row.grams),
    })
    itemsByMeal.set(row.meal_id, items)
  }

  const meals: DayMeal[] = mealRows.results.map((row) => {
    const items = itemsByMeal.get(row.id) ?? []
    return {
      id: row.id,
      type: row.meal_type as MealType,
      occurredAt: row.occurred_at,
      localDate: row.local_date,
      note: row.note,
      totals: sumTotals(items.map((item) => item.totals)),
      items,
    }
  })

  return Response.json({
    date,
    targetKcal: profile?.target_kcal ?? null,
    totals: sumTotals(meals.map((meal) => meal.totals)),
    meals,
  })
}

export async function createMeal(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const parsed = parseMealInput(await readJson(request), true)
  if (!parsed.ok) return badRequest(parsed.error)
  const input = parsed.value
  if (!input.occurredAt || !input.localDate) return badRequest('Richiesta non valida.')

  const now = new Date().toISOString()
  const mealId = crypto.randomUUID()
  const itemIds = input.items.map(() => crypto.randomUUID())
  const favorites = await resolveFavorites(env, userId, input.items)

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO meals (id, user_id, occurred_at, local_date, meal_type, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(mealId, userId, input.occurredAt, input.localDate, input.type, input.note, now, now),
  ]

  const written = new Set<string>()
  input.items.forEach((item, index) => {
    const favorite = favorites[index]!
    if (!written.has(favorite.id)) {
      statements.push(favoriteStatement(env, userId, item, favorite, now))
      written.add(favorite.id)
    }
    statements.push(itemStatement(env, mealId, itemIds[index]!, item, favorite, index))
  })

  await env.DB.batch(statements)

  return Response.json(
    mealPayload(mealId, input, input.occurredAt, input.localDate, itemIds),
    { status: 201 },
  )
}

export async function updateMeal(
  request: Request,
  env: Env,
  userId: string,
  mealId: string,
): Promise<Response> {
  const parsed = parseMealInput(await readJson(request), false)
  if (!parsed.ok) return badRequest(parsed.error)
  const input = parsed.value

  const existing = await env.DB.prepare(
    `SELECT occurred_at, local_date FROM meals
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
  )
    .bind(mealId, userId)
    .first<{ occurred_at: string; local_date: string }>()
  if (!existing) return notFound()

  const now = new Date().toISOString()
  const itemIds = input.items.map(() => crypto.randomUUID())
  const favorites = await resolveFavorites(env, userId, input.items)

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      'UPDATE meals SET meal_type = ?, note = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    ).bind(input.type, input.note, now, mealId, userId),
    env.DB.prepare('DELETE FROM meal_items WHERE meal_id = ?').bind(mealId),
  ]

  const written = new Set<string>()
  input.items.forEach((item, index) => {
    const favorite = favorites[index]!
    if (!written.has(favorite.id)) {
      statements.push(favoriteStatement(env, userId, item, favorite, now))
      written.add(favorite.id)
    }
    statements.push(itemStatement(env, mealId, itemIds[index]!, item, favorite, index))
  })

  await env.DB.batch(statements)

  return Response.json(
    mealPayload(mealId, input, existing.occurred_at, existing.local_date, itemIds),
  )
}

export async function deleteMeal(env: Env, userId: string, mealId: string): Promise<Response> {
  const now = new Date().toISOString()
  await env.DB.prepare(
    `UPDATE meals SET deleted_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
  )
    .bind(now, now, mealId, userId)
    .run()

  return new Response(null, { status: 204 })
}

interface FoodRow {
  id: string
  name: string
  brand: string | null
  source: string
  source_id: string | null
  kcal_100g: number
  protein_100g: number
  carbs_100g: number
  fat_100g: number
  fiber_100g: number
  sugar_100g: number
  salt_100g: number
  last_used_at: string | null
}

export async function listFoods(env: Env, userId: string): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT id, name, brand, source, source_id,
            kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, salt_100g,
            last_used_at
     FROM foods
     WHERE user_id = ?
     ORDER BY last_used_at DESC, lower(name) ASC`,
  )
    .bind(userId)
    .all<FoodRow>()

  const foods: Food[] = rows.results.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    source: row.source as FoodSource,
    sourceId: row.source_id,
    per100g: {
      kcal: row.kcal_100g,
      protein: row.protein_100g,
      carbs: row.carbs_100g,
      fat: row.fat_100g,
      fiber: row.fiber_100g,
      sugar: row.sugar_100g,
      salt: row.salt_100g,
    },
    lastUsedAt: row.last_used_at,
  }))

  return Response.json(foods)
}
