import { sumTotals } from '../lib/diary'
import { dayNumber } from '../lib/stats'
import type { Env } from './env'
import { isRealDate, mealsByDate } from './meals'

export const MAX_STATS_RANGE_DAYS = 800

export interface StatsDay {
  date: string
  kcal: number
  meals: number
}

export interface StatsResponse {
  targetKcal: number | null
  days: StatsDay[]
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 })
}

type StatsRange = { from: string; to: string }

/** Both bounds are required, real dates; the range is inclusive and at most 800 days. */
function parseRange(url: URL): StatsRange | null {
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (!isRealDate(from) || !isRealDate(to)) return null
  if (from > to) return null
  if (dayNumber(to) - dayNumber(from) + 1 > MAX_STATS_RANGE_DAYS) return null
  return { from, to }
}

export async function getStats(request: Request, env: Env, userId: string): Promise<Response> {
  const range = parseRange(new URL(request.url))
  if (!range) {
    return badRequest(
      `Intervallo non valido: usa from e to reali con from non successivo a to e al massimo ${MAX_STATS_RANGE_DAYS} giorni.`,
    )
  }

  const profile = await env.DB.prepare('SELECT target_kcal FROM profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ target_kcal: number }>()

  const meals = await mealsByDate(env, userId, range.from, range.to)

  const days: StatsDay[] = [...meals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayMeals]) => ({
      date,
      kcal: sumTotals(dayMeals.map((meal) => meal.totals)).kcal,
      meals: dayMeals.length,
    }))

  const response: StatsResponse = {
    targetKcal: profile?.target_kcal ?? null,
    days,
  }
  return Response.json(response)
}
