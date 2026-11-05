// PROTOTIPO — dati finti, nessuna persistenza. Da buttare.
export type Source = 'off' | 'usda' | 'manual'

export interface Food {
  id: string
  name: string
  brand?: string
  source: Source
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  salt?: number
}

export interface MealItem {
  food: Food
  grams: number
}

export interface Meal {
  id: string
  type: string
  label: string
  time: string
  note?: string
  items: MealItem[]
}

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  salt: number
}

export interface Profile {
  weightKg: number
  heightCm: number
  sex: 'm' | 'f'
  birthDate: string
  targetKcal: number
}

export const profile: Profile = {
  weightKg: 78,
  heightCm: 178,
  sex: 'm',
  birthDate: '1990-04-12',
  targetKcal: 2200,
}

export const mealTypes = [
  { value: 'colazione', label: 'Colazione', from: 5, to: 10.5 },
  { value: 'merenda-mattina', label: 'Merenda mattina', from: 10.5, to: 12 },
  { value: 'pranzo', label: 'Pranzo', from: 12, to: 15 },
  { value: 'merenda-pomeriggio', label: 'Merenda pomeriggio', from: 15, to: 18 },
  { value: 'cena', label: 'Cena', from: 18, to: 22 },
  { value: 'post-cena', label: 'Post-cena', from: 22, to: 29 },
]

export function suggestMealType(hour: number) {
  const h = hour < 5 ? hour + 24 : hour
  return mealTypes.find((type) => h >= type.from && h < type.to) ?? mealTypes[0]
}

export function zeroTotals(): Totals {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, salt: 0 }
}

export function itemTotals(item: MealItem): Totals {
  const factor = item.grams / 100
  const food = item.food
  return {
    kcal: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    fiber: (food.fiber ?? 0) * factor,
    sugar: (food.sugar ?? 0) * factor,
    salt: (food.salt ?? 0) * factor,
  }
}

export function sumTotals(list: Totals[]): Totals {
  return list.reduce((acc, value) => ({
    kcal: acc.kcal + value.kcal,
    protein: acc.protein + value.protein,
    carbs: acc.carbs + value.carbs,
    fat: acc.fat + value.fat,
    fiber: acc.fiber + value.fiber,
    sugar: acc.sugar + value.sugar,
    salt: acc.salt + value.salt,
  }), zeroTotals())
}

export function mealTotals(meal: Meal): Totals {
  return sumTotals(meal.items.map(itemTotals))
}

export function dayTotals(meals: Meal[]): Totals {
  return sumTotals(meals.map(mealTotals))
}

export function macroPercent(totals: Totals) {
  const kcal = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9
  if (kcal === 0) return { protein: 0, carbs: 0, fat: 0 }
  return {
    protein: Math.round((totals.protein * 4 * 100) / kcal),
    carbs: Math.round((totals.carbs * 4 * 100) / kcal),
    fat: Math.round((totals.fat * 9 * 100) / kcal),
  }
}

export function round(value: number, digits = 0): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const foods = {
  yogurt: { id: 'yogurt', name: 'Yogurt greco 0%', brand: 'Fage', source: 'off', kcal: 57, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0, sugar: 3.6, salt: 0.1 },
  mirtilli: { id: 'mirtilli', name: 'Mirtilli', source: 'usda', kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fiber: 2.4, sugar: 10 },
  fette: { id: 'fette', name: 'Fette biscottate', brand: 'Galbusera', source: 'off', kcal: 408, protein: 11, carbs: 78, fat: 7, fiber: 3.5, sugar: 12, salt: 0.8 },
  mandorle: { id: 'mandorle', name: 'Mandorle', source: 'usda', kcal: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, sugar: 4.4 },
  pasta: { id: 'pasta', name: 'Pasta di semola', source: 'usda', kcal: 356, protein: 12, carbs: 71, fat: 1.5, fiber: 3, sugar: 3.2 },
  passata: { id: 'passata', name: 'Passata di pomodoro', brand: 'Pomì', source: 'off', kcal: 27, protein: 1.3, carbs: 4, fat: 0.2, fiber: 1.5, sugar: 4, salt: 0.55 },
  parmigiano: { id: 'parmigiano', name: 'Parmigiano Reggiano', source: 'off', kcal: 402, protein: 33, carbs: 0, fat: 30, fiber: 0, sugar: 0, salt: 1.6 },
  mela: { id: 'mela', name: 'Mela', source: 'usda', kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, sugar: 10.4 },
  pollo: { id: 'pollo', name: 'Petto di pollo', source: 'usda', kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, salt: 0.2 },
  insalata: { id: 'insalata', name: 'Insalata', source: 'usda', kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3, sugar: 0.8 },
  olio: { id: 'olio', name: 'Olio extravergine di oliva', brand: 'Monini', source: 'off', kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0 },
  pane: { id: 'pane', name: 'Pane integrale', source: 'manual', kcal: 247, protein: 13, carbs: 41, fat: 3.4, fiber: 7, sugar: 3.5, salt: 1.1 },
  banana: { id: 'banana', name: 'Banana', source: 'usda', kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2 },
  uova: { id: 'uova', name: 'Uova', source: 'usda', kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0, sugar: 0.4, salt: 0.4 },
  riso: { id: 'riso', name: 'Riso bianco', source: 'usda', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1 },
} satisfies Record<string, Food>

export const todayMeals: Meal[] = [
  {
    id: 'm1', type: 'colazione', label: 'Colazione', time: '07:40',
    items: [{ food: foods.yogurt, grams: 170 }, { food: foods.mirtilli, grams: 80 }, { food: foods.fette, grams: 30 }],
  },
  {
    id: 'm2', type: 'merenda-mattina', label: 'Merenda mattina', time: '10:30',
    items: [{ food: foods.mandorle, grams: 20 }],
  },
  {
    id: 'm3', type: 'pranzo', label: 'Pranzo', time: '13:10', note: 'Pasta al pomodoro, porzione piccola',
    items: [{ food: foods.pasta, grams: 80 }, { food: foods.passata, grams: 100 }, { food: foods.parmigiano, grams: 15 }],
  },
  {
    id: 'm4', type: 'merenda-pomeriggio', label: 'Merenda pomeriggio', time: '16:30',
    items: [{ food: foods.mela, grams: 180 }],
  },
  {
    id: 'm5', type: 'cena', label: 'Cena', time: '20:15',
    items: [{ food: foods.pollo, grams: 150 }, { food: foods.insalata, grams: 100 }, { food: foods.olio, grams: 10 }],
  },
]

export const favorites: Food[] = [
  foods.yogurt, foods.fette, foods.pasta, foods.passata, foods.parmigiano,
  foods.mela, foods.pollo, foods.olio, foods.pane, foods.uova, foods.banana, foods.riso,
]

export const searchResults = {
  off: [
    { ...foods.passata, id: 'off-passata', name: 'Passata di pomodoro', brand: 'Pomì' },
    { ...foods.yogurt, id: 'off-yogurt', name: 'Yogurt greco 0%', brand: 'Fage' },
    { ...foods.fette, id: 'off-fette', name: 'Fette biscottate integrali', brand: 'Galbusera' },
    { ...foods.parmigiano, id: 'off-parmigiano', name: 'Parmigiano Reggiano 24 mesi', brand: 'Consorzio' },
    { ...foods.olio, id: 'off-olio', name: 'Olio extravergine di oliva', brand: 'Monini' },
    { ...foods.pollo, id: 'off-pollo', name: 'Petto di pollo a fette', brand: 'AIA' },
  ] as Food[],
  usda: [
    { ...foods.pasta, id: 'usda-pasta', name: 'Pasta, dry, enriched, spaghetti' },
    { ...foods.mela, id: 'usda-mela', name: 'Apple, raw, with skin' },
    { ...foods.mirtilli, id: 'usda-mirtilli', name: 'Blueberries, raw' },
    { ...foods.mandorle, id: 'usda-mandorle', name: 'Almonds, raw' },
    { ...foods.insalata, id: 'usda-insalata', name: 'Lettuce, raw' },
    { ...foods.pollo, id: 'usda-pollo', name: 'Chicken, breast, roasted' },
  ] as Food[],
}

export function searchFoods(query: string) {
  const q = query.trim().toLowerCase()
  const match = (food: Food) =>
    food.name.toLowerCase().includes(q) || (food.brand ?? '').toLowerCase().includes(q)
  return {
    off: searchResults.off.filter(match),
    usda: searchResults.usda.filter(match),
  }
}
