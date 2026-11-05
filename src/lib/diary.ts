import type { MealType } from './meal-types'

export type FoodSource = 'off' | 'usda' | 'manual'

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  salt: number
}

/** Values stored on a meal item: kcal and macros are required, the rest may be unknown. */
export interface ItemNutrition {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number | null
  sugar: number | null
  salt: number | null
}

export interface Food {
  id: string
  name: string
  brand: string | null
  source: FoodSource
  sourceId: string | null
  per100g: Totals
  servingG?: number | null
  servingLabel?: string | null
  lastUsedAt: string | null
}

export interface SearchFood {
  id: string
  name: string
  brand: string | null
  barcode: string | null
  source: FoodSource
  sourceId: string | null
  per100g: ItemNutrition
  serving: { grams: number; label: string } | null
}

export interface FoodSearchResponse {
  off: SearchFood[]
  usda: SearchFood[]
}

export interface DayItem {
  id: string
  name: string
  source: FoodSource | null
  brand: string | null
  sourceId: string | null
  grams: number
  per100g: ItemNutrition
  totals: Totals
}

export interface DayMeal {
  id: string
  type: MealType
  occurredAt: string
  localDate: string
  note: string | null
  totals: Totals
  items: DayItem[]
}

export interface Day {
  date: string
  targetKcal: number | null
  totals: Totals
  meals: DayMeal[]
}

export const ZERO_TOTALS: Totals = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  salt: 0,
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Totals ignore unknown nutrients: a null contributes 0 to the day. */
export function itemTotals(per100g: ItemNutrition, grams: number): Totals {
  const ratio = grams / 100
  return {
    kcal: round(per100g.kcal * ratio, 1),
    protein: round(per100g.protein * ratio, 2),
    carbs: round(per100g.carbs * ratio, 2),
    fat: round(per100g.fat * ratio, 2),
    fiber: round((per100g.fiber ?? 0) * ratio, 2),
    sugar: round((per100g.sugar ?? 0) * ratio, 2),
    salt: round((per100g.salt ?? 0) * ratio, 2),
  }
}

export function sumTotals(list: Totals[]): Totals {
  const sum = { ...ZERO_TOTALS }
  for (const totals of list) {
    sum.kcal += totals.kcal
    sum.protein += totals.protein
    sum.carbs += totals.carbs
    sum.fat += totals.fat
    sum.fiber += totals.fiber
    sum.sugar += totals.sugar
    sum.salt += totals.salt
  }
  return {
    kcal: round(sum.kcal, 1),
    protein: round(sum.protein, 2),
    carbs: round(sum.carbs, 2),
    fat: round(sum.fat, 2),
    fiber: round(sum.fiber, 2),
    sugar: round(sum.sugar, 2),
    salt: round(sum.salt, 2),
  }
}

/** Share of calories from each macro; the macros never have their own target. */
export function macroPercent(totals: Totals): { protein: number; carbs: number; fat: number } {
  const kcal = totals.kcal
  if (kcal <= 0) return { protein: 0, carbs: 0, fat: 0 }
  return {
    protein: Math.round(((totals.protein * 4) / kcal) * 100),
    carbs: Math.round(((totals.carbs * 4) / kcal) * 100),
    fat: Math.round(((totals.fat * 9) / kcal) * 100),
  }
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const numberFormatter = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 })
const kcalFormatter = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatKcal(value: number): string {
  return kcalFormatter.format(value)
}
