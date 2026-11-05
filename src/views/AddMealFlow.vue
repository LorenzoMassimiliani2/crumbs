<script setup lang="ts">
import {
  Apple,
  Coffee,
  Cookie,
  Minus,
  Moon,
  Pencil,
  Plus,
  Search,
  Trash2,
  Utensils,
  UtensilsCrossed,
  X,
} from '@lucide/vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import {
  formatKcal,
  formatNumber,
  itemTotals,
  round,
  sumTotals,
  type DayMeal,
  type Food,
  type FoodSearchResponse,
  type FoodSource,
  type ItemNutrition,
  type SearchFood,
} from '@/lib/diary'
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  suggestMealType,
  type MealType,
} from '@/lib/meal-types'

const props = defineProps<{
  date: string
  meal?: DayMeal | null
  favorites: Food[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
  favoritesChanged: []
}>()

interface DraftItem {
  key: number
  name: string
  source: FoodSource
  sourceId: string | null
  brand: string | null
  per100g: ItemNutrition
  grams: number
}

let nextKey = 1

function draftFromMeal(meal: DayMeal | null | undefined): DraftItem[] {
  if (!meal) return []
  return meal.items.map((item) => ({
    key: nextKey++,
    name: item.name,
    source: item.source ?? 'manual',
    sourceId: item.sourceId,
    brand: item.brand,
    per100g: item.per100g,
    grams: item.grams,
  }))
}

const MEAL_TYPE_ICONS: Record<MealType, typeof Coffee> = {
  colazione: Coffee,
  merenda_mattina: Apple,
  pranzo: UtensilsCrossed,
  merenda_pomeriggio: Cookie,
  cena: Utensils,
  post_cena: Moon,
}

const MEAL_TYPE_SHORT_LABELS: Record<MealType, string> = {
  colazione: 'Colazione',
  merenda_mattina: 'Mattina',
  pranzo: 'Pranzo',
  merenda_pomeriggio: 'Pomeriggio',
  cena: 'Cena',
  post_cena: 'Dopo cena',
}

const GRAMS_STEP = 10

const type = ref<MealType>(props.meal?.type ?? suggestMealType())
const note = ref(props.meal?.note ?? '')
const draft = ref<DraftItem[]>(draftFromMeal(props.meal))
const query = ref('')
const creating = ref(false)
const saving = ref(false)
const error = ref('')
const confirmingDelete = ref(false)
const searchResults = ref<SearchFood[]>([])
const searching = ref(false)
const searchError = ref('')
const usdaMissing = ref(false)
const addingCode = ref<string | null>(null)
const searchedTerm = ref('')
const source = ref<'usda' | 'off'>('usda')

const SEARCH_PAUSE_MS = 600
let searchTimer: ReturnType<typeof setTimeout> | null = null

const manual = reactive({
  name: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  sugar: '',
  salt: '',
})

const FOOD_MACROS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'salt'] as const

const editing = computed(() => props.meal != null)

const editingFood = ref<Food | null>(null)
const deletingFood = ref<Food | null>(null)
const foodSaving = ref(false)
const foodFeedback = ref('')
const foodError = ref('')
const foodForm = reactive({
  name: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  sugar: '',
  salt: '',
})

/** Favorites belong to the active search group: packaged products vs simple foods. */
const favoriteMatches = computed(() => {
  const term = query.value.trim().toLowerCase()
  return props.favorites.filter((food) => {
    if (source.value === 'off' ? food.source !== 'off' : food.source === 'off') return false
    if (!term) return true
    return `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(term)
  })
})

/** Do not list the same food twice when the remote search returns a saved favorite. */
const visibleResults = computed(() => {
  const saved = new Set(
    favoriteMatches.value.map((food) => food.sourceId).filter((id): id is string => id !== null),
  )
  return searchResults.value.filter((food) => food.sourceId === null || !saved.has(food.sourceId))
})

const draftTotals = computed(() =>
  sumTotals(draft.value.map((item) => itemTotals(item.per100g, item.grams))),
)

function addFavorite(food: Food): void {
  draft.value.push({
    key: nextKey++,
    name: food.name,
    source: food.source,
    sourceId: food.sourceId,
    brand: food.brand,
    per100g: food.per100g,
    grams: 100,
  })
  query.value = ''
}

function clearSearchTimer(): void {
  if (searchTimer !== null) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
}

function resetSearch(): void {
  clearSearchTimer()
  searchResults.value = []
  searchError.value = ''
  usdaMissing.value = false
  searchedTerm.value = ''
  searching.value = false
}

function scheduleSearch(): void {
  clearSearchTimer()
  const term = query.value.trim()
  if (term.length < 3) {
    resetSearch()
    return
  }
  searchTimer = setTimeout(() => {
    void runSearch()
  }, SEARCH_PAUSE_MS)
}

async function runSearch(): Promise<void> {
  clearSearchTimer()
  const term = query.value.trim()
  if (term.length < 3) return

  const requestedSource = source.value
  searching.value = true
  searchError.value = ''
  usdaMissing.value = false
  searchedTerm.value = term

  try {
    const response = await apiFetch(
      `/api/foods/search?q=${encodeURIComponent(term)}&source=${requestedSource}`,
    )
    if (query.value.trim() !== term || source.value !== requestedSource) return
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string
        code?: string
      } | null
      searchResults.value = []
      searchError.value = body?.error ?? 'Ricerca non riuscita. Riprova.'
      usdaMissing.value = body?.code === 'usda_not_configured'
      return
    }
    const body = (await response.json()) as FoodSearchResponse
    searchResults.value = body[requestedSource] ?? []
  } catch {
    if (query.value.trim() === term && source.value === requestedSource) {
      searchResults.value = []
      searchError.value = 'Impossibile contattare il server.'
    }
  } finally {
    if (source.value === requestedSource) searching.value = false
  }
}

function addResult(food: SearchFood): void {
  if (food.source === 'off') {
    void addProduct(food)
    return
  }
  addSearchFood(food)
}

function addSearchFood(food: SearchFood): void {
  draft.value.push({
    key: nextKey++,
    name: food.name,
    source: food.source,
    sourceId: food.sourceId,
    brand: food.brand,
    per100g: food.per100g,
    grams: 100,
  })
  query.value = ''
  resetSearch()
}

async function addProduct(food: SearchFood): Promise<void> {
  if (addingCode.value !== null) return
  const code = food.sourceId ?? food.id
  addingCode.value = code
  searchError.value = ''

  try {
    const response = await apiFetch(`/api/foods/off/${encodeURIComponent(code)}`)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      searchError.value = body?.error ?? 'Prodotto non disponibile. Riprova.'
      return
    }
    addSearchFood((await response.json()) as SearchFood)
  } catch {
    searchError.value = 'Impossibile contattare il server.'
  } finally {
    addingCode.value = null
  }
}

watch(query, scheduleSearch)
watch(source, () => {
  if (query.value.trim().length >= 3) void runSearch()
  else resetSearch()
})
onBeforeUnmount(clearSearchTimer)

function setGrams(item: DraftItem, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value.replace(',', '.'))
  item.grams = Number.isFinite(value) ? value : 0
}

function stepGrams(item: DraftItem, delta: number): void {
  const next = (Number.isFinite(item.grams) ? item.grams : 0) + delta
  item.grams = Math.min(5000, Math.max(1, round(next, 1)))
}

function removeItem(key: number): void {
  draft.value = draft.value.filter((item) => item.key !== key)
}

function openManual(): void {
  manual.name = query.value.trim()
  creating.value = true
  error.value = ''
}

function numberField(value: string | number): number {
  const text = String(value).trim()
  return text === '' ? 0 : Number(text)
}

/** An empty optional field means unknown, not zero. */
function optionalField(value: string | number): number | null {
  const text = String(value).trim()
  return text === '' ? null : Number(text)
}

function invalidNutrients(per100g: ItemNutrition): boolean {
  return Object.values(per100g).some(
    (value) => value !== null && (!Number.isFinite(value) || value < 0),
  )
}

function macroText(value: number | null, grams: number): string {
  return value === null ? '—' : `${formatNumber(round((value * grams) / 100, 2))} g`
}

function addManual(): void {
  const name = manual.name.trim()
  const per100g: ItemNutrition = {
    kcal: numberField(manual.kcal),
    protein: optionalField(manual.protein),
    carbs: optionalField(manual.carbs),
    fat: optionalField(manual.fat),
    fiber: optionalField(manual.fiber),
    sugar: optionalField(manual.sugar),
    salt: optionalField(manual.salt),
  }

  if (!name) {
    error.value = "Il nome dell'alimento è obbligatorio."
    return
  }
  if (invalidNutrients(per100g)) {
    error.value = 'I valori per 100 g devono essere numeri non negativi.'
    return
  }

  draft.value.push({
    key: nextKey++,
    name,
    source: 'manual',
    sourceId: null,
    brand: null,
    per100g,
    grams: 100,
  })
  creating.value = false
  query.value = ''
  error.value = ''
}

function fillFoodForm(food: Food): void {
  foodForm.name = food.name
  for (const macro of FOOD_MACROS) {
    const value = food.per100g[macro]
    foodForm[macro] = value === null ? '' : String(value)
  }
}

function openFoodEdit(food: Food): void {
  fillFoodForm(food)
  editingFood.value = food
  deletingFood.value = null
  foodFeedback.value = ''
  foodError.value = ''
}

function cancelFoodEdit(): void {
  editingFood.value = null
  foodError.value = ''
}

function askFoodDelete(food: Food): void {
  deletingFood.value = food
  editingFood.value = null
  foodFeedback.value = ''
  foodError.value = ''
}

function cancelFoodDelete(): void {
  deletingFood.value = null
}

async function saveFoodEdit(): Promise<void> {
  if (!editingFood.value || foodSaving.value) return

  const name = foodForm.name.trim()
  const per100g: ItemNutrition = {
    kcal: numberField(foodForm.kcal),
    protein: optionalField(foodForm.protein),
    carbs: optionalField(foodForm.carbs),
    fat: optionalField(foodForm.fat),
    fiber: optionalField(foodForm.fiber),
    sugar: optionalField(foodForm.sugar),
    salt: optionalField(foodForm.salt),
  }
  if (!name) {
    foodError.value = "Il nome dell'alimento è obbligatorio."
    return
  }
  if (invalidNutrients(per100g)) {
    foodError.value = 'I valori per 100 g devono essere numeri non negativi.'
    return
  }

  foodSaving.value = true
  foodError.value = ''
  try {
    const response = await apiFetch(`/api/foods/${editingFood.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, per100g }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      foodError.value = body?.error ?? 'Salvataggio non riuscito. Riprova.'
      return
    }
    editingFood.value = null
    foodFeedback.value = 'Preferito aggiornato.'
    emit('favoritesChanged')
  } catch {
    foodError.value = 'Impossibile contattare il server.'
  } finally {
    foodSaving.value = false
  }
}

async function confirmFoodDelete(): Promise<void> {
  if (!deletingFood.value || foodSaving.value) return

  foodSaving.value = true
  foodError.value = ''
  try {
    const response = await apiFetch(`/api/foods/${deletingFood.value.id}`, { method: 'DELETE' })
    if (!response.ok) {
      foodError.value = 'Eliminazione non riuscita. Riprova.'
      return
    }
    deletingFood.value = null
    foodFeedback.value = 'Preferito eliminato. I pasti già registrati non cambiano.'
    emit('favoritesChanged')
  } catch {
    foodError.value = 'Impossibile contattare il server.'
  } finally {
    foodSaving.value = false
  }
}

function occurredAtForSave(): string {
  if (props.meal) return props.meal.occurredAt
  const [year, month, day] = props.date.split('-').map(Number) as [number, number, number]
  const now = new Date()
  return new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ).toISOString()
}

function payload(): Record<string, unknown> {
  return {
    occurredAt: occurredAtForSave(),
    localDate: props.date,
    type: type.value,
    note: note.value.trim() || null,
    items: draft.value.map((item) => ({
      name: item.name,
      source: item.source,
      sourceId: item.sourceId,
      brand: item.brand,
      grams: item.grams,
      per100g: item.per100g,
    })),
  }
}

async function save(): Promise<void> {
  if (draft.value.length === 0 || saving.value) return
  saving.value = true
  error.value = ''

  try {
    const response = await apiFetch(
      editing.value ? `/api/meals/${props.meal!.id}` : '/api/meals',
      {
        method: editing.value ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      },
    )

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      error.value = body?.error ?? 'Salvataggio non riuscito. Riprova.'
      return
    }

    emit('saved')
  } catch {
    error.value = 'Impossibile contattare il server. La bozza è ancora qui.'
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  if (!props.meal || saving.value) return
  saving.value = true
  error.value = ''

  try {
    const response = await apiFetch(`/api/meals/${props.meal.id}`, { method: 'DELETE' })
    if (!response.ok) {
      error.value = 'Eliminazione non riuscita. Riprova.'
      return
    }
    emit('deleted')
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    saving.value = false
  }
}

const gramsInputClass =
  'w-16 bg-transparent py-1 text-sm font-medium tabular-nums outline-none focus-visible:text-foreground'

const macroDotClass: Record<'protein' | 'carbs' | 'fat', string> = {
  protein: 'bg-sky-500',
  carbs: 'bg-amber-500',
  fat: 'bg-rose-500',
}
</script>

<template>
  <div
    data-testid="add-meal-flow"
    class="fixed inset-0 z-40 flex justify-center bg-foreground/40"
    role="dialog"
    aria-modal="true"
    :aria-label="editing ? 'Modifica pasto' : 'Aggiungi pasto'"
  >
    <div class="flex h-full w-full max-w-2xl flex-col bg-background">
      <header class="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" type="button" aria-label="Chiudi" @click="emit('close')">
          <X />
        </Button>
        <h2 class="text-base font-semibold">
          {{ editing ? 'Modifica pasto' : 'Aggiungi pasto' }}
        </h2>
      </header>

      <div class="flex-1 space-y-5 overflow-y-auto px-4 pb-40 pt-4">
        <section class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tipo di pasto
          </p>
          <div
            data-testid="meal-type-picker"
            role="group"
            aria-label="Tipo di pasto"
            class="grid grid-cols-6 gap-1"
          >
            <button
              v-for="option in MEAL_TYPES"
              :key="option"
              type="button"
              :data-testid="`meal-type-${option}`"
              :aria-label="MEAL_TYPE_LABELS[option]"
              :aria-pressed="type === option"
              class="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-0.5 py-2 text-center text-[10px] font-medium leading-tight transition-colors"
              :class="
                type === option
                  ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                  : 'border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground'
              "
              @click="type = option"
            >
              <component :is="MEAL_TYPE_ICONS[option]" class="size-4 shrink-0" aria-hidden="true" />
              <span class="hyphens-auto break-words">{{ MEAL_TYPE_SHORT_LABELS[option] }}</span>
            </button>
          </div>
        </section>

        <section class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cerca alimento
          </p>

          <div class="flex gap-2">
            <div class="relative min-w-0 flex-1">
              <Search
                class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                v-model="query"
                type="search"
                aria-label="Cerca alimenti e prodotti"
                placeholder="Cerca un alimento o un prodotto"
                class="pl-9"
                @keydown.enter.prevent="runSearch"
              />
            </div>
            <select
              v-model="source"
              data-testid="source-select"
              aria-label="Fonte di ricerca"
              class="h-9 shrink-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="usda">Alimenti semplici</option>
              <option value="off">Prodotti confezionati</option>
            </select>
          </div>

          <p v-if="searchError" data-testid="search-error" role="alert" class="text-xs text-destructive">
            {{ searchError }}
            <span v-if="usdaMissing">Scegli "Prodotti confezionati" o crea un alimento.</span>
          </p>

          <Button
            type="button"
            variant="outline"
            class="w-full"
            data-testid="create-food"
            @click="openManual"
          >
            Crea alimento
          </Button>

          <p v-if="foodFeedback" role="status" class="text-sm text-muted-foreground">
            {{ foodFeedback }}
          </p>
          <p v-if="foodError" role="alert" class="text-sm text-destructive">{{ foodError }}</p>

          <section
            v-if="editingFood"
            data-testid="edit-food"
            class="space-y-3 rounded-xl border border-border bg-card p-3"
          >
            <p class="text-sm font-semibold">Modifica alimento</p>
            <div class="space-y-1.5">
              <Label for="edit-food-name">Nome</Label>
              <Input id="edit-food-name" v-model="foodForm.name" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label for="edit-food-kcal">Kcal / 100 g</Label>
                <Input id="edit-food-kcal" v-model="foodForm.kcal" type="number" inputmode="decimal" min="0" step="any" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-food-protein">Proteine / 100 g</Label>
                <Input id="edit-food-protein" v-model="foodForm.protein" type="number" inputmode="decimal" min="0" step="any" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-food-carbs">Carboidrati / 100 g</Label>
                <Input id="edit-food-carbs" v-model="foodForm.carbs" type="number" inputmode="decimal" min="0" step="any" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-food-fat">Grassi / 100 g</Label>
                <Input id="edit-food-fat" v-model="foodForm.fat" type="number" inputmode="decimal" min="0" step="any" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-food-fiber">Fibre / 100 g</Label>
                <Input id="edit-food-fiber" v-model="foodForm.fiber" type="number" inputmode="decimal" min="0" step="any" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-food-sugar">Zuccheri / 100 g</Label>
                <Input id="edit-food-sugar" v-model="foodForm.sugar" type="number" inputmode="decimal" min="0" step="any" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-food-salt">Sale / 100 g</Label>
                <Input id="edit-food-salt" v-model="foodForm.salt" type="number" inputmode="decimal" min="0" step="any" />
              </div>
            </div>
            <div class="flex gap-2">
              <Button type="button" data-testid="save-food-edit" :disabled="foodSaving" @click="saveFoodEdit">
                Salva
              </Button>
              <Button type="button" variant="ghost" @click="cancelFoodEdit">Annulla</Button>
            </div>
          </section>

          <section
            v-if="deletingFood"
            data-testid="confirm-delete-food"
            class="space-y-2 rounded-xl border border-destructive/40 p-3"
          >
            <p class="text-sm">Eliminare "{{ deletingFood.name }}" dai preferiti?</p>
            <p class="text-xs text-muted-foreground">I pasti già registrati non cambiano.</p>
            <div class="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                data-testid="confirm-delete-food-button"
                :disabled="foodSaving"
                @click="confirmFoodDelete"
              >
                Elimina
              </Button>
              <Button type="button" variant="ghost" @click="cancelFoodDelete">Annulla</Button>
            </div>
          </section>
        </section>

        <section
          v-if="favoriteMatches.length || query.trim().length >= 3"
          :data-testid="source === 'off' ? 'off-group' : 'usda-group'"
          class="space-y-2"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {{ source === 'off' ? 'Prodotti confezionati' : 'Alimenti semplici' }}
          </p>

          <div v-if="favoriteMatches.length" class="space-y-2">
            <div
              v-for="food in favoriteMatches"
              :key="food.id"
              data-testid="favorite-row"
              class="flex items-center gap-1 rounded-xl border border-primary/50 bg-primary/5 pr-1"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-left"
                @click="addFavorite(food)"
              >
                <span class="min-w-0">
                  <span class="flex items-center gap-1.5">
                    <span class="truncate text-sm">{{ food.name }}</span>
                    <span
                      data-testid="favorite-badge"
                      class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                    >
                      Preferito
                    </span>
                  </span>
                  <span class="block text-xs text-muted-foreground">
                    {{ food.brand ?? (food.source === 'manual' ? 'Manuale' : food.source.toUpperCase()) }}
                    · {{ formatKcal(food.per100g.kcal) }} kcal/100 g
                  </span>
                </span>
                <Plus class="size-4 text-muted-foreground" aria-hidden="true" />
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                :aria-label="`Modifica preferito ${food.name}`"
                @click="openFoodEdit(food)"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                :aria-label="`Elimina preferito ${food.name}`"
                @click="askFoodDelete(food)"
              >
                <Trash2 />
              </Button>
            </div>
          </div>

          <p v-if="searching" class="text-xs text-muted-foreground">Ricerca…</p>

          <div v-else-if="visibleResults.length" class="space-y-2">
            <button
              v-for="food in visibleResults"
              :key="food.id"
              type="button"
              :data-testid="source === 'off' ? 'off-result' : 'usda-result'"
              :disabled="addingCode !== null"
              class="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left disabled:opacity-60"
              @click="addResult(food)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm">{{ food.name }}</span>
                <span class="block text-xs text-muted-foreground">
                  {{ food.brand ? `${food.brand} · ` : '' }}{{ formatKcal(food.per100g.kcal) }} kcal/100 g ·
                  {{ source === 'off' ? 'Open Food Facts' : 'USDA' }}
                </span>
              </span>
              <Plus class="size-4 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>

          <p
            v-else-if="searchedTerm && favoriteMatches.length === 0"
            class="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground"
          >
            {{ source === 'off' ? 'Nessun prodotto trovato.' : 'Nessun alimento trovato.' }}
          </p>
        </section>

        <section v-if="creating" class="space-y-3 rounded-xl border border-border bg-card p-3">
          <p class="text-sm font-semibold">Nuovo alimento</p>
          <div class="space-y-1.5">
            <Label for="food-name">Nome</Label>
            <Input id="food-name" v-model="manual.name" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label for="food-kcal">Kcal / 100 g</Label>
              <Input id="food-kcal" v-model="manual.kcal" type="number" inputmode="decimal" min="0" step="any" />
            </div>
            <div class="space-y-1.5">
              <Label for="food-protein">Proteine / 100 g</Label>
              <Input id="food-protein" v-model="manual.protein" type="number" inputmode="decimal" min="0" step="any" />
            </div>
            <div class="space-y-1.5">
              <Label for="food-carbs">Carboidrati / 100 g</Label>
              <Input id="food-carbs" v-model="manual.carbs" type="number" inputmode="decimal" min="0" step="any" />
            </div>
            <div class="space-y-1.5">
              <Label for="food-fat">Grassi / 100 g</Label>
              <Input id="food-fat" v-model="manual.fat" type="number" inputmode="decimal" min="0" step="any" />
            </div>
            <div class="space-y-1.5">
              <Label for="food-fiber">Fibre / 100 g</Label>
              <Input id="food-fiber" v-model="manual.fiber" type="number" inputmode="decimal" min="0" step="any" />
            </div>
            <div class="space-y-1.5">
              <Label for="food-sugar">Zuccheri / 100 g</Label>
              <Input id="food-sugar" v-model="manual.sugar" type="number" inputmode="decimal" min="0" step="any" />
            </div>
            <div class="space-y-1.5">
              <Label for="food-salt">Sale / 100 g</Label>
              <Input id="food-salt" v-model="manual.salt" type="number" inputmode="decimal" min="0" step="any" />
            </div>
          </div>
          <div class="flex gap-2">
            <Button type="button" data-testid="add-manual-food" @click="addManual">Aggiungi alimento</Button>
            <Button type="button" variant="ghost" @click="creating = false">Annulla</Button>
          </div>
        </section>

        <section class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Nel pasto
          </p>

          <p v-if="draft.length === 0" class="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Aggiungi almeno un alimento.
          </p>

          <div
            v-for="item in draft"
            :key="item.key"
            class="rounded-xl border border-border bg-card px-3 py-3"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="min-w-0 truncate text-sm font-medium">{{ item.name }}</p>
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                class="-mr-1 shrink-0"
                :aria-label="`Rimuovi ${item.name}`"
                @click="removeItem(item.key)"
              >
                <X />
              </Button>
            </div>

            <dl
              :data-testid="`item-macros-${item.name}`"
              class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
            >
              <p
                :data-testid="`item-kcal-${item.name}`"
                class="ml-auto shrink-0 text-sm font-semibold tabular-nums text-foreground"
              >
                {{ formatKcal(itemTotals(item.per100g, item.grams).kcal) }}
                <span class="text-[11px] font-normal text-muted-foreground">kcal</span>
              </p>
              <div class="flex items-center gap-1">
                <span :class="macroDotClass.protein" class="size-1.5 rounded-full" aria-hidden="true"></span>
                <dt>P</dt>
                <dd class="font-medium tabular-nums text-foreground">
                  {{ macroText(item.per100g.protein, item.grams) }}
                </dd>
              </div>
              <div class="flex items-center gap-1">
                <span :class="macroDotClass.carbs" class="size-1.5 rounded-full" aria-hidden="true"></span>
                <dt>C</dt>
                <dd class="font-medium tabular-nums text-foreground">
                  {{ macroText(item.per100g.carbs, item.grams) }}
                </dd>
              </div>
              <div class="flex items-center gap-1">
                <span :class="macroDotClass.fat" class="size-1.5 rounded-full" aria-hidden="true"></span>
                <dt>G</dt>
                <dd class="font-medium tabular-nums text-foreground">
                  {{ macroText(item.per100g.fat, item.grams) }}
                </dd>
              </div>
            </dl>

            <div class="mt-3 flex items-center justify-between gap-3 border-t border-border pt-2.5">
              <span class="text-[11px] text-muted-foreground">Quantità</span>
              <div
                :data-testid="`grams-stepper-${item.name}`"
                class="flex h-9 items-center rounded-lg border border-input bg-background"
              >
                <button
                  type="button"
                  class="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  :aria-label="`Diminuisci grammi ${item.name}`"
                  :disabled="item.grams <= 1"
                  @click="stepGrams(item, -GRAMS_STEP)"
                >
                  <Minus class="size-4" aria-hidden="true" />
                </button>
                <input
                  :value="item.grams"
                  :aria-label="`Grammi ${item.name}`"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  :class="gramsInputClass"
                  class="text-center"
                  @input="setGrams(item, $event)"
                />
                <span class="pr-1 text-xs text-muted-foreground">g</span>
                <button
                  type="button"
                  class="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  :aria-label="`Aumenta grammi ${item.name}`"
                  :disabled="item.grams >= 5000"
                  @click="stepGrams(item, GRAMS_STEP)"
                >
                  <Plus class="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-1.5">
            <Label for="meal-note">Nota</Label>
            <Input id="meal-note" v-model="note" placeholder="Nota (opzionale)" />
          </div>
        </section>

        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

        <section v-if="editing" class="space-y-2">
          <Button
            v-if="!confirmingDelete"
            type="button"
            variant="destructive"
            class="w-full"
            @click="confirmingDelete = true"
          >
            Elimina pasto
          </Button>
          <div v-else class="space-y-2 rounded-xl border border-destructive/40 p-3">
            <p class="text-sm">Vuoi davvero eliminare questo pasto?</p>
            <div class="flex gap-2">
              <Button type="button" variant="destructive" @click="remove">Conferma eliminazione</Button>
              <Button type="button" variant="ghost" @click="confirmingDelete = false">Annulla</Button>
            </div>
          </div>
        </section>
      </div>

      <footer class="border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div class="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{{ draft.length }} {{ draft.length === 1 ? 'alimento' : 'alimenti' }}</span>
          <span data-testid="draft-total" class="tabular-nums">
            {{ formatKcal(draftTotals.kcal) }} kcal
          </span>
        </div>
        <Button
          type="button"
          class="w-full"
          size="lg"
          data-testid="save-meal"
          :disabled="draft.length === 0 || saving"
          @click="save"
        >
          {{ saving ? 'Salvataggio…' : 'Salva pasto' }}
        </Button>
      </footer>
    </div>
  </div>
</template>
