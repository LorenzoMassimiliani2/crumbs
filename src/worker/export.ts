import { itemTotals, round, sumTotals, type FoodSource, type Totals } from '../lib/diary'
import type { MealType } from '../lib/meal-types'
import type { Env } from './env'
import { isRealDate } from './meals'

export interface ExportItem extends Totals {
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
  protein_100g: number
  carbs_100g: number
  fat_100g: number
  fiber_100g: number
  sugar_100g: number
  salt_100g: number
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
    const per100g: Totals = {
      kcal: row.kcal_100g,
      protein: row.protein_100g,
      carbs: row.carbs_100g,
      fat: row.fat_100g,
      fiber: row.fiber_100g,
      sugar: row.sugar_100g,
      salt: row.salt_100g,
    }
    const totals = itemTotals(per100g, row.grams)

    items.push({
      date: row.date,
      type: row.type as MealType,
      name: row.name,
      grams: row.grams,
      ...totals,
      source: row.source as FoodSource,
    })

    const list = dayTotals.get(row.date) ?? []
    list.push(totals)
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
