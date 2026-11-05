<script setup lang="ts">
import { ChevronLeft, ChevronRight, Pencil, Plus } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import {
  formatKcal,
  formatNumber,
  macroPercent,
  toLocalDateString,
  ZERO_TOTALS,
  type Day,
  type DayMeal,
  type Food,
} from '@/lib/diary'
import { MEAL_TYPE_LABELS } from '@/lib/meal-types'
import { apiFetch } from '@/lib/api'
import AddMealFlow from './AddMealFlow.vue'

const selectedDate = ref(toLocalDateString(new Date()))
const day = ref<Day | null>(null)
const favorites = ref<Food[]>([])
const loading = ref(true)
const error = ref('')
const addOpen = ref(false)
const editing = ref<DayMeal | null>(null)

const dateLabel = computed(() => {
  const [year, month, dayOfMonth] = selectedDate.value.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, dayOfMonth))
})

const totals = computed(() => day.value?.totals ?? ZERO_TOTALS)
const macro = computed(() => macroPercent(totals.value))
const delta = computed(() =>
  day.value?.targetKcal == null ? null : day.value.targetKcal - totals.value.kcal,
)
const progress = computed(() => {
  const target = day.value?.targetKcal
  if (!target) return 0
  return Math.min(100, Math.round((totals.value.kcal / target) * 100))
})

async function loadDay(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/api/days/${selectedDate.value}`)
    if (!response.ok) {
      error.value = 'Impossibile caricare il giorno.'
      return
    }
    day.value = (await response.json()) as Day
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    loading.value = false
  }
}

async function loadFavorites(): Promise<void> {
  try {
    const response = await apiFetch('/api/foods')
    if (response.ok) favorites.value = (await response.json()) as Food[]
  } catch {
    favorites.value = []
  }
}

function shiftDay(offset: number): void {
  const [year, month, dayOfMonth] = selectedDate.value.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  const date = new Date(year, month - 1, dayOfMonth)
  date.setDate(date.getDate() + offset)
  selectedDate.value = toLocalDateString(date)
}

function pickDate(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) selectedDate.value = value
}

function openAdd(meal: DayMeal | null = null): void {
  editing.value = meal
  addOpen.value = true
}

function closeAdd(): void {
  addOpen.value = false
  editing.value = null
}

async function afterChange(): Promise<void> {
  closeAdd()
  await Promise.all([loadDay(), loadFavorites()])
}

function mealTime(occurredAt: string): string {
  return new Date(occurredAt).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(selectedDate, () => {
  void loadDay()
})

onMounted(() => {
  void loadDay()
  void loadFavorites()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="Giorno precedente"
        @click="shiftDay(-1)"
      >
        <ChevronLeft />
      </Button>

      <div class="flex items-center gap-2">
        <span data-testid="day-label" class="text-sm font-medium capitalize">
          {{ dateLabel }}
        </span>
        <input
          :value="selectedDate"
          data-testid="day-picker"
          aria-label="Scegli data"
          type="date"
          class="h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          @change="pickDate"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="Giorno successivo"
        @click="shiftDay(1)"
      >
        <ChevronRight />
      </Button>
    </div>

    <p v-if="loading && !day" class="text-sm text-muted-foreground">Caricamento…</p>
    <p v-else-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

    <template v-if="day">
      <section class="rounded-2xl border border-border bg-card p-4">
        <div class="flex items-end justify-between gap-3">
          <div>
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Consumate</p>
            <p data-testid="day-consumed" class="text-3xl font-semibold tabular-nums">
              {{ formatKcal(totals.kcal) }}
              <span class="text-sm font-normal text-muted-foreground">kcal</span>
            </p>
          </div>
          <p class="text-xs text-muted-foreground tabular-nums">
            Target
            <span data-testid="day-target">{{
              day.targetKcal === null ? '—' : formatKcal(day.targetKcal)
            }}</span>
            kcal
          </p>
        </div>

        <p data-testid="day-delta" class="mt-1 text-sm">
          <template v-if="delta === null">Imposta il target nel Profilo.</template>
          <template v-else-if="delta >= 0">Ti restano {{ formatKcal(delta) }} kcal</template>
          <template v-else>Oltre di {{ formatKcal(-delta) }} kcal</template>
        </p>

        <div v-if="day.targetKcal !== null" class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${progress}%` }" />
        </div>

        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-xl bg-muted/60 py-2">
            <p class="text-sm font-semibold tabular-nums">{{ formatNumber(totals.protein) }} g</p>
            <p class="text-[11px] text-muted-foreground">Proteine · {{ macro.protein }}%</p>
          </div>
          <div class="rounded-xl bg-muted/60 py-2">
            <p class="text-sm font-semibold tabular-nums">{{ formatNumber(totals.carbs) }} g</p>
            <p class="text-[11px] text-muted-foreground">Carboidrati · {{ macro.carbs }}%</p>
          </div>
          <div class="rounded-xl bg-muted/60 py-2">
            <p class="text-sm font-semibold tabular-nums">{{ formatNumber(totals.fat) }} g</p>
            <p class="text-[11px] text-muted-foreground">Grassi · {{ macro.fat }}%</p>
          </div>
        </div>
      </section>

      <article
        v-for="meal in day.meals"
        :key="meal.id"
        class="rounded-2xl border border-border bg-card"
      >
        <div class="flex items-center justify-between gap-2 px-4 pt-4">
          <div class="min-w-0">
            <p class="text-sm font-semibold">{{ MEAL_TYPE_LABELS[meal.type] }}</p>
            <p class="text-[11px] text-muted-foreground">{{ mealTime(meal.occurredAt) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground tabular-nums">
              {{ formatKcal(meal.totals.kcal) }} kcal
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              :aria-label="`Modifica ${MEAL_TYPE_LABELS[meal.type]}`"
              @click="openAdd(meal)"
            >
              <Pencil />
            </Button>
          </div>
        </div>

        <ul class="mt-2 divide-y divide-border/70 px-4 pb-3">
          <li
            v-for="item in meal.items"
            :key="item.id"
            class="flex items-center justify-between gap-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-sm">{{ item.name }}</p>
              <p class="text-[11px] text-muted-foreground">
                {{ formatNumber(item.grams) }} g<template v-if="item.brand"> · {{ item.brand }}</template>
              </p>
            </div>
            <span class="shrink-0 text-sm text-muted-foreground tabular-nums">
              {{ formatKcal(item.totals.kcal) }} kcal
            </span>
          </li>
        </ul>

        <p
          v-if="meal.note"
          class="border-t border-border/70 px-4 py-2 text-[11px] italic text-muted-foreground"
        >
          {{ meal.note }}
        </p>
      </article>

      <p
        v-if="day.meals.length === 0"
        class="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
      >
        Nessun pasto in questo giorno.
      </p>
    </template>
  </div>

  <Button
    type="button"
    size="icon-lg"
    data-testid="add-meal"
    aria-label="Aggiungi pasto"
    class="fixed bottom-20 right-[max(1rem,calc(50%-20rem))] z-30 size-14 rounded-full shadow-lg"
    @click="openAdd()"
  >
    <Plus class="size-6" />
  </Button>

  <AddMealFlow
    v-if="addOpen"
    :date="selectedDate"
    :meal="editing"
    :favorites="favorites"
    @close="closeAdd"
    @saved="afterChange"
    @deleted="afterChange"
    @favorites-changed="loadFavorites"
  />
</template>
