export const MEAL_TYPES = [
  'colazione',
  'merenda_mattina',
  'pranzo',
  'merenda_pomeriggio',
  'cena',
  'post_cena',
] as const

export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  colazione: 'Colazione',
  merenda_mattina: 'Merenda mattina',
  pranzo: 'Pranzo',
  merenda_pomeriggio: 'Merenda pomeriggio',
  cena: 'Cena',
  post_cena: 'Post-cena',
}

export function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value)
}

/**
 * Proposes the meal type from the local clock. The user can always change it.
 * Windows: 05:00–10:30, 10:30–12:00, 12:00–15:00, 15:00–18:00, 18:00–22:00, 22:00–05:00.
 */
export function suggestMealType(at: Date = new Date()): MealType {
  const minutes = at.getHours() * 60 + at.getMinutes()

  if (minutes >= 5 * 60 && minutes < 10 * 60 + 30) return 'colazione'
  if (minutes >= 10 * 60 + 30 && minutes < 12 * 60) return 'merenda_mattina'
  if (minutes >= 12 * 60 && minutes < 15 * 60) return 'pranzo'
  if (minutes >= 15 * 60 && minutes < 18 * 60) return 'merenda_pomeriggio'
  if (minutes >= 18 * 60 && minutes < 22 * 60) return 'cena'
  return 'post_cena'
}
