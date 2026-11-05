<script setup lang="ts">
import { Plus, Search, X } from '@lucide/vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import {
  formatKcal,
  itemTotals,
  sumTotals,
  type DayMeal,
  type Food,
  type FoodSearchResponse,
  type FoodSource,
  type ItemNutrition,
  type SearchFood,
  type Totals,
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
const addingCode = ref<string | null>(null)
const searchedTerm = ref('')

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

const editing = computed(() => props.meal != null)

const filteredFavorites = computed(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) return props.favorites
  return props.favorites.filter((food) => {
    const haystack = `${food.name} ${food.brand ?? ''}`.toLowerCase()
    return haystack.includes(term)
  })
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

  searching.value = true
  searchError.value = ''
  searchedTerm.value = term

  try {
    const response = await apiFetch(`/api/foods/search?q=${encodeURIComponent(term)}`)
    if (query.value.trim() !== term) return
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      searchResults.value = []
      searchError.value = body?.error ?? 'Ricerca non riuscita. Riprova.'
      return
    }
    const body = (await response.json()) as FoodSearchResponse
    searchResults.value = body.off ?? []
  } catch {
    if (query.value.trim() === term) {
      searchResults.value = []
      searchError.value = 'Impossibile contattare il server.'
    }
  } finally {
    searching.value = false
  }
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
onBeforeUnmount(clearSearchTimer)

function setGrams(item: DraftItem, event: Event): void {
  item.grams = Number((event.target as HTMLInputElement).value)
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

function addManual(): void {
  const name = manual.name.trim()
  const per100g: Totals = {
    kcal: numberField(manual.kcal),
    protein: numberField(manual.protein),
    carbs: numberField(manual.carbs),
    fat: numberField(manual.fat),
    fiber: numberField(manual.fiber),
    sugar: numberField(manual.sugar),
    salt: numberField(manual.salt),
  }

  if (!name) {
    error.value = "Il nome dell'alimento è obbligatorio."
    return
  }
  if (Object.values(per100g).some((value) => !Number.isFinite(value) || value < 0)) {
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
  'h-9 w-20 rounded-md border border-input bg-transparent px-2 text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
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
        <div class="flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="option in MEAL_TYPES"
            :key="option"
            type="button"
            :data-testid="`meal-type-${option}`"
            :aria-pressed="type === option"
            class="shrink-0 rounded-full border px-3 py-1.5 text-xs"
            :class="
              type === option
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground'
            "
            @click="type = option"
          >
            {{ MEAL_TYPE_LABELS[option] }}
          </button>
        </div>

        <section class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preferiti</p>

          <div class="relative">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              v-model="query"
              type="search"
              aria-label="Cerca nei preferiti"
              placeholder="Cerca un alimento"
              class="pl-9"
              @keydown.enter.prevent="runSearch"
            />
          </div>

          <div v-if="filteredFavorites.length" class="space-y-2">
            <button
              v-for="food in filteredFavorites"
              :key="food.id"
              type="button"
              class="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left"
              @click="addFavorite(food)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm">{{ food.name }}</span>
                <span class="block text-xs text-muted-foreground">
                  {{ food.brand ?? (food.source === 'manual' ? 'Manuale' : food.source.toUpperCase()) }}
                  · {{ formatKcal(food.per100g.kcal) }} kcal/100 g
                </span>
              </span>
              <Plus class="size-4 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>

          <p v-else class="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Nessun preferito trovato.
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
        </section>

        <section
          v-if="query.trim().length >= 3"
          data-testid="off-group"
          class="space-y-2"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Prodotti confezionati
          </p>

          <p v-if="searching" class="text-xs text-muted-foreground">Ricerca…</p>

          <div v-else-if="searchResults.length" class="space-y-2">
            <button
              v-for="food in searchResults"
              :key="food.id"
              type="button"
              data-testid="off-result"
              :disabled="addingCode !== null"
              class="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left disabled:opacity-60"
              @click="addProduct(food)"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm">{{ food.name }}</span>
                <span class="block text-xs text-muted-foreground">
                  {{ food.brand ? `${food.brand} · ` : '' }}{{ formatKcal(food.per100g.kcal) }} kcal/100 g · Open Food Facts
                </span>
              </span>
              <Plus class="size-4 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>

          <p
            v-else-if="searchedTerm"
            class="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground"
          >
            Nessun prodotto trovato.
          </p>

          <p v-if="searchError" role="alert" class="text-xs text-destructive">{{ searchError }}</p>
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
            class="rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm">{{ item.name }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ formatKcal(itemTotals(item.per100g, item.grams).kcal) }} kcal
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                :aria-label="`Rimuovi ${item.name}`"
                @click="removeItem(item.key)"
              >
                <X />
              </Button>
            </div>
            <div class="mt-2 flex items-center gap-2">
              <input
                :value="item.grams"
                :aria-label="`Grammi ${item.name}`"
                type="number"
                inputmode="decimal"
                min="1"
                max="5000"
                step="any"
                :class="gramsInputClass"
                @input="setGrams(item, $event)"
              />
              <span class="text-xs text-muted-foreground">g</span>
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
