import {
  itemNutrientTotals,
  round,
  sumTotals,
  type FoodSource,
  type ItemNutrition,
  type Totals,
} from '../lib/diary'
import type { MealType } from '../lib/meal-types'
import type { Env } from './env'
import { isRealDate } from './meals'

export interface ExportItem extends ItemNutrition {
  date: string
  type: MealType
  name: string
  grams: number
  source: FoodSource
}

export interface ExportDay {
  date: string
  kcal: number
  targetKcal: number | null
  delta: number | null
  protein: number
  carbs: number
  fat: number
}

interface ItemRow {
  date: string
  type: string
  name: string
  source: string
  grams: number
  kcal_100g: number
  protein_100g: number | null
  carbs_100g: number | null
  fat_100g: number | null
  fiber_100g: number | null
  sugar_100g: number | null
  salt_100g: number | null
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 })
}

export async function exportDiary(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const params = new URL(request.url).searchParams
  const from = params.get('from')
  const to = params.get('to')

  if (!isRealDate(from) || !isRealDate(to) || from > to) {
    return badRequest('Intervallo di date non valido.')
  }

  const profile = await env.DB.prepare('SELECT target_kcal FROM profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ target_kcal: number }>()
  const targetKcal = profile?.target_kcal ?? null

  const rows = await env.DB.prepare(
    `SELECT m.local_date AS date, m.meal_type AS type, mi.name_snapshot AS name,
            mi.source, mi.grams,
            mi.kcal_100g, mi.protein_100g, mi.carbs_100g, mi.fat_100g,
            mi.fiber_100g, mi.sugar_100g, mi.salt_100g
     FROM meal_items mi
     JOIN meals m ON m.id = mi.meal_id
     WHERE m.user_id = ? AND m.deleted_at IS NULL
       AND m.local_date >= ? AND m.local_date <= ?
     ORDER BY m.local_date ASC, m.occurred_at ASC, mi.position ASC`,
  )
    .bind(userId, from, to)
    .all<ItemRow>()

  const items: ExportItem[] = []
  const dayTotals = new Map<string, Totals[]>()

  for (const row of rows.results) {
    const per100g: ItemNutrition = {
      kcal: row.kcal_100g,
      protein: row.protein_100g,
      carbs: row.carbs_100g,
      fat: row.fat_100g,
      fiber: row.fiber_100g,
      sugar: row.sugar_100g,
      salt: row.salt_100g,
    }
    const item = itemNutrientTotals(per100g, row.grams)

    items.push({
      date: row.date,
      type: row.type as MealType,
      name: row.name,
      grams: row.grams,
      ...item,
      source: row.source as FoodSource,
    })

    const list = dayTotals.get(row.date) ?? []
    list.push({
      kcal: item.kcal,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
      fiber: item.fiber ?? 0,
      sugar: item.sugar ?? 0,
      salt: item.salt ?? 0,
    })
    dayTotals.set(row.date, list)
  }

  const days: ExportDay[] = [...dayTotals.entries()].map(([date, totals]) => {
    const dayTotal = sumTotals(totals)
    return {
      date,
      kcal: dayTotal.kcal,
      targetKcal,
      delta: targetKcal === null ? null : round(targetKcal - dayTotal.kcal, 1),
      protein: dayTotal.protein,
      carbs: dayTotal.carbs,
      fat: dayTotal.fat,
    }
  })

  return Response.json({ from, to, targetKcal, items, days })
}
