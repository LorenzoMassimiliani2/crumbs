import type { Food, FoodSource, ItemNutrition } from '../lib/diary'
import type { Env } from './env'

const MAX_NAME = 120
const MAX_SERVING_LABEL = 60
const MAX_SERVING_GRAMS = 5000
const MAX_PER_100G = 100000

export interface FoodFields {
  name: string
  per100g: ItemNutrition
  servingG: number | null
  servingLabel: string | null
}

export type ParsedFood = { ok: true; value: FoodFields } | { ok: false; error: string }

const OPTIONAL_MACROS = ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'salt'] as const

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.length <= maxLength ? trimmed : undefined
}

function toNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function parsePer100g(value: unknown): ItemNutrition | string {
  if (value === null || typeof value !== 'object') return 'I valori per 100 g non sono validi.'
  const input = value as Record<string, unknown>

  const kcal = toNumber(input.kcal)
  if (kcal === null || kcal < 0 || kcal > MAX_PER_100G) {
    return 'I valori per 100 g devono essere numeri non negativi.'
  }

  const totals: ItemNutrition = {
    kcal,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
    sugar: null,
    salt: null,
  }
  for (const macro of OPTIONAL_MACROS) {
    const raw = input[macro]
    if (raw === undefined || raw === null) continue
    const amount = toNumber(raw)
    if (amount === null || amount < 0 || amount > MAX_PER_100G) {
      return 'I valori per 100 g devono essere numeri non negativi.'
    }
    totals[macro] = amount
  }
  return totals
}

function parseServingG(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null
  const grams = toNumber(value)
  if (grams === null || grams <= 0 || grams > MAX_SERVING_GRAMS) {
    return undefined
  }
  return grams
}

export function parseFoodInput(body: unknown): ParsedFood {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Richiesta non valida.' }
  }
  const input = body as Record<string, unknown>

  const name = optionalText(input.name, MAX_NAME)
  if (!name) return { ok: false, error: "Il nome dell'alimento è obbligatorio." }

  const per100g = parsePer100g(input.per100g)
  if (typeof per100g === 'string') return { ok: false, error: per100g }

  const servingG = parseServingG(input.servingG)
  if (servingG === undefined) {
    return { ok: false, error: `I grammi della porzione devono essere maggiori di 0 e al massimo ${MAX_SERVING_GRAMS}.` }
  }

  const servingLabel = optionalText(input.servingLabel, MAX_SERVING_LABEL)
  if (servingLabel === undefined) {
    return { ok: false, error: 'La descrizione della porzione non è valida.' }
  }

  return { ok: true, value: { name, per100g, servingG, servingLabel } }
}

function numbers(per100g: ItemNutrition): (number | null)[] {
  return [per100g.kcal, per100g.protein, per100g.carbs, per100g.fat, per100g.fiber, per100g.sugar, per100g.salt]
}

interface FoodRow {
  id: string
  name: string
  brand: string | null
  source: string
  source_id: string | null
  kcal_100g: number
  protein_100g: number | null
  carbs_100g: number | null
  fat_100g: number | null
  fiber_100g: number | null
  sugar_100g: number | null
  salt_100g: number | null
  serving_g: number | null
  serving_label: string | null
  last_used_at: string | null
}

const FOOD_COLUMNS = `id, name, brand, source, source_id,
  kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, salt_100g,
  serving_g, serving_label, last_used_at`

function foodFromRow(row: FoodRow): Food {
  return {
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
    servingG: row.serving_g,
    servingLabel: row.serving_label,
    lastUsedAt: row.last_used_at,
  }
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 })
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function findById(env: Env, userId: string, id: string): Promise<FoodRow | null> {
  return env.DB.prepare(`SELECT ${FOOD_COLUMNS} FROM foods WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<FoodRow>()
}

export async function createFood(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const parsed = parseFoodInput(await readJson(request))
  if (!parsed.ok) return badRequest(parsed.error)
  const input = parsed.value

  const existing = await env.DB.prepare(
    `SELECT ${FOOD_COLUMNS} FROM foods
     WHERE user_id = ? AND source = 'manual' AND source_id IS NULL
       AND lower(trim(name)) = lower(trim(?))`,
  )
    .bind(userId, input.name)
    .first<FoodRow>()

  const now = new Date().toISOString()
  if (existing) {
    await env.DB.prepare(
      `UPDATE foods SET
         name = ?, kcal_100g = ?, protein_100g = ?, carbs_100g = ?, fat_100g = ?,
         fiber_100g = ?, sugar_100g = ?, salt_100g = ?,
         serving_g = ?, serving_label = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(
        input.name,
        ...numbers(input.per100g),
        input.servingG,
        input.servingLabel,
        now,
        existing.id,
        userId,
      )
      .run()

    const row = await findById(env, userId, existing.id)
    return Response.json(foodFromRow(row!))
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO foods
       (id, user_id, name, brand, source, source_id,
        kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, salt_100g,
        serving_g, serving_label, last_used_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'manual', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  )
    .bind(id, userId, input.name, ...numbers(input.per100g), input.servingG, input.servingLabel, now, now)
    .run()

  const row = await findById(env, userId, id)
  return Response.json(foodFromRow(row!), { status: 201 })
}

export type ParsedFoodPatch =
  | {
      ok: true
      value: {
        name?: string
        per100g?: ItemNutrition
        servingG?: number | null
        servingLabel?: string | null
      }
    }
  | { ok: false; error: string }

export function parseFoodPatch(body: unknown): ParsedFoodPatch {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Richiesta non valida.' }
  }
  const input = body as Record<string, unknown>
  const value: Exclude<ParsedFoodPatch, { ok: false }>['value'] = {}

  if ('name' in input) {
    const name = optionalText(input.name, MAX_NAME)
    if (!name) return { ok: false, error: "Il nome dell'alimento è obbligatorio." }
    value.name = name
  }

  if ('per100g' in input) {
    const per100g = parsePer100g(input.per100g)
    if (typeof per100g === 'string') return { ok: false, error: per100g }
    value.per100g = per100g
  }

  if ('servingG' in input) {
    const servingG = parseServingG(input.servingG)
    if (servingG === undefined) {
      return {
        ok: false,
        error: `I grammi della porzione devono essere maggiori di 0 e al massimo ${MAX_SERVING_GRAMS}.`,
      }
    }
    value.servingG = servingG
  }

  if ('servingLabel' in input) {
    const servingLabel = optionalText(input.servingLabel, MAX_SERVING_LABEL)
    if (servingLabel === undefined) {
      return { ok: false, error: 'La descrizione della porzione non è valida.' }
    }
    value.servingLabel = servingLabel
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: 'Nessun campo da aggiornare.' }
  }

  return { ok: true, value }
}

export async function updateFood(
  request: Request,
  env: Env,
  userId: string,
  id: string,
): Promise<Response> {
  const existing = await findById(env, userId, id)
  if (!existing) return Response.json({ error: 'Alimento non trovato.' }, { status: 404 })

  const parsed = parseFoodPatch(await readJson(request))
  if (!parsed.ok) return badRequest(parsed.error)
  const patch = parsed.value

  if (patch.name !== undefined && existing.source_id === null) {
    const duplicate = await env.DB.prepare(
      `SELECT id FROM foods
       WHERE user_id = ? AND source_id IS NULL AND id <> ?
         AND lower(trim(name)) = lower(trim(?))`,
    )
      .bind(userId, id, patch.name)
      .first<{ id: string }>()
    if (duplicate) {
      return Response.json(
        { error: 'Esiste già un alimento con questo nome.' },
        { status: 409 },
      )
    }
  }

  await env.DB.prepare(
    `UPDATE foods SET
       name = ?, kcal_100g = ?, protein_100g = ?, carbs_100g = ?, fat_100g = ?,
       fiber_100g = ?, sugar_100g = ?, salt_100g = ?,
       serving_g = ?, serving_label = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(
      patch.name ?? existing.name,
      ...numbers(patch.per100g ?? {
        kcal: existing.kcal_100g,
        protein: existing.protein_100g,
        carbs: existing.carbs_100g,
        fat: existing.fat_100g,
        fiber: existing.fiber_100g,
        sugar: existing.sugar_100g,
        salt: existing.salt_100g,
      }),
      patch.servingG !== undefined ? patch.servingG : existing.serving_g,
      patch.servingLabel !== undefined ? patch.servingLabel : existing.serving_label,
      new Date().toISOString(),
      id,
      userId,
    )
    .run()

  const row = await findById(env, userId, id)
  return Response.json(foodFromRow(row!))
}

export async function deleteFood(env: Env, userId: string, id: string): Promise<Response> {
  const result = await env.DB.prepare('DELETE FROM foods WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run()

  if (result.meta.changes === 0) {
    return Response.json({ error: 'Alimento non trovato.' }, { status: 404 })
  }

  return new Response(null, { status: 204 })
}
