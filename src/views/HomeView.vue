<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell, Pencil, Plus, Utensils } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { formatDuration, type DayActivity } from '@/lib/activity'
import {
  formatKcal,
  formatNumber,
  macroPercent,
  toLocalDateString,
  ZERO_TOTALS,
  type Day,
  type DayMeal,
  type Food,
  type FoodSource,
} from '@/lib/diary'
import { MEAL_TYPE_LABELS } from '@/lib/meal-types'
import { apiFetch } from '@/lib/api'
import { trendRange, type Stats } from '@/lib/stats'
import CalorieTrend from '@/components/CalorieTrend.vue'
import AddActivityFlow from './AddActivityFlow.vue'
import AddMealFlow from './AddMealFlow.vue'

const selectedDate = ref(toLocalDateString(new Date()))
const datePicker = ref<HTMLInputElement | null>(null)

function openDatePicker(): void {
  const input = datePicker.value
  if (!input) return
  if (typeof input.showPicker === 'function') input.showPicker()
  else input.click()
}
const day = ref<Day | null>(null)
const stats = ref<Stats | null>(null)
const today = computed(() => toLocalDateString(new Date()))
const favorites = ref<Food[]>([])
const loading = ref(true)
const error = ref('')
const chooserOpen = ref(false)
const addOpen = ref(false)
const activityOpen = ref(false)
const editing = ref<DayMeal | null>(null)
const editingActivity = ref<DayActivity | null>(null)

const SOURCE_LABELS: Record<FoodSource, string> = {
  off: 'Open Food Facts',
  usda: 'USDA',
  manual: 'Manuale',
}

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

const isToday = computed(() => selectedDate.value === toLocalDateString(new Date()))

function goToday(): void {
  selectedDate.value = toLocalDateString(new Date())
}

let touchStart: { x: number; y: number } | null = null

function onTouchStart(event: TouchEvent): void {
  const touch = event.changedTouches[0]
  if (touch) touchStart = { x: touch.clientX, y: touch.clientY }
}

function onTouchEnd(event: TouchEvent): void {
  const touch = event.changedTouches[0]
  const start = touchStart
  touchStart = null
  if (!touch || !start) return
  const dx = touch.clientX - start.x
  const dy = touch.clientY - start.y
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
  shiftDay(dx < 0 ? 1 : -1)
}

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
  // Never render a previous day's meals under the date being loaded.
  day.value = null
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

/** One request covers the current 14 days and the previous 14 for the variation. */
async function loadStats(): Promise<void> {
  const { from, to } = trendRange(today.value)
  try {
    const response = await apiFetch(`/api/stats?from=${from}&to=${to}`)
    if (response.ok) stats.value = (await response.json()) as Stats
  } catch {
    // The trend is a secondary section: a failure never blocks the diary.
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

function selectDay(date: string): void {
  selectedDate.value = date
}

function pickDate(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) selectedDate.value = value
}

function openChooser(): void {
  chooserOpen.value = true
}

function chooseMeal(): void {
  chooserOpen.value = false
  editing.value = null
  addOpen.value = true
}

function chooseActivity(): void {
  chooserOpen.value = false
  editingActivity.value = null
  activityOpen.value = true
}

function closeChooser(): void {
  chooserOpen.value = false
}

function openAdd(meal: DayMeal): void {
  editing.value = meal
  addOpen.value = true
}

function closeAdd(): void {
  addOpen.value = false
  editing.value = null
}

function openActivityEdit(activity: DayActivity): void {
  editingActivity.value = activity
  activityOpen.value = true
}

function closeActivity(): void {
  activityOpen.value = false
  editingActivity.value = null
}

async function afterMealChange(): Promise<void> {
  closeAdd()
  await Promise.all([loadDay(), loadFavorites(), loadStats()])
}

async function afterActivityChange(): Promise<void> {
  closeActivity()
  await loadDay()
}

function timeLabel(instant: string): string {
  return new Date(instant).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

type TimelineEntry =
  | { kind: 'meal'; key: string; at: string; meal: DayMeal }
  | { kind: 'activity'; key: string; at: string; activity: DayActivity }

/** Meals and activities share one chronological sequence. */
const timeline = computed<TimelineEntry[]>(() => {
  const entries: TimelineEntry[] = []
  for (const meal of day.value?.meals ?? []) {
    entries.push({ kind: 'meal', key: `meal-${meal.id}`, at: meal.occurredAt, meal })
  }
  for (const activity of day.value?.activities ?? []) {
    entries.push({
      kind: 'activity',
      key: `activity-${activity.id}`,
      at: activity.startedAt,
      activity,
    })
  }
  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
})

const dayEmpty = computed(
  () => (day.value?.meals?.length ?? 0) === 0 && (day.value?.activities?.length ?? 0) === 0,
)

watch(selectedDate, () => {
  void loadDay()
})

onMounted(() => {
  void loadDay()
  void loadFavorites()
  void loadStats()
})
</script>

<template>
  <div data-testid="home-view" class="space-y-4" @touchstart="onTouchStart" @touchend="onTouchEnd">
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
        <button
          type="button"
          aria-label="Scegli data"
          class="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          @click="openDatePicker"
        >
          <CalendarDays class="size-4" />
        </button>
        <input
          ref="datePicker"
          :value="selectedDate"
          data-testid="day-picker"
          aria-label="Scegli data"
          type="date"
          tabindex="-1"
          aria-hidden="true"
          class="sr-only"
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

    <div v-if="!isToday" class="flex justify-center">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-testid="back-to-today"
        @click="goToday"
      >
        Torna a oggi
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

      <CalorieTrend v-if="stats" :stats="stats" :today="today" @select="selectDay" />

      <template v-for="entry in timeline" :key="entry.key">
      <article
        v-if="entry.kind === 'meal'"
        class="rounded-2xl border border-border bg-card"
      >
        <div class="flex items-center justify-between gap-2 px-4 pt-4">
          <div class="min-w-0">
            <p class="text-sm font-semibold">{{ MEAL_TYPE_LABELS[entry.meal.type] }}</p>
            <p class="text-[11px] text-muted-foreground">{{ timeLabel(entry.meal.occurredAt) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground tabular-nums">
              {{ formatKcal(entry.meal.totals.kcal) }} kcal
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              :aria-label="`Modifica ${MEAL_TYPE_LABELS[entry.meal.type]}`"
              @click="openAdd(entry.meal)"
            >
              <Pencil />
            </Button>
          </div>
        </div>

        <ul class="mt-2 divide-y divide-border/70 px-4 pb-3">
          <li
            v-for="item in entry.meal.items"
            :key="item.id"
            class="flex items-center justify-between gap-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-sm">{{ item.name }}</p>
              <p class="text-[11px] text-muted-foreground">
                {{ formatNumber(item.grams) }} g<template v-if="item.brand"> · {{ item.brand }}</template><template v-if="item.source"> · {{ SOURCE_LABELS[item.source] }}</template>
              </p>
            </div>
            <span class="shrink-0 text-sm text-muted-foreground tabular-nums">
              {{ formatKcal(item.totals.kcal) }} kcal
            </span>
          </li>
        </ul>

        <p
          v-if="entry.meal.note"
          class="border-t border-border/70 px-4 py-2 text-[11px] italic text-muted-foreground"
        >
          {{ entry.meal.note }}
        </p>
      </article>

      <article
        v-else
        data-testid="activity-row"
        class="rounded-2xl border border-border bg-card px-4 py-3"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <Dumbbell class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p class="truncate text-sm font-medium">{{ entry.activity.name }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span class="text-[11px] text-muted-foreground tabular-nums">
              {{ formatDuration(entry.activity.durationMinutes) }}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              data-testid="edit-activity"
              :aria-label="`Modifica attività ${entry.activity.name}`"
              @click="openActivityEdit(entry.activity)"
            >
              <Pencil />
            </Button>
          </div>
        </div>
        <p class="mt-0.5 pl-6 text-[11px] text-muted-foreground tabular-nums">
          {{ timeLabel(entry.activity.startedAt) }}–{{ timeLabel(entry.activity.endedAt) }}
        </p>
        <p
          v-if="entry.activity.note"
          class="mt-1 pl-6 text-[11px] italic text-muted-foreground"
        >
          {{ entry.activity.note }}
        </p>
      </article>
      </template>

      <div
        v-if="dayEmpty"
        class="rounded-2xl border border-dashed border-border p-6 text-center"
      >
        <p class="text-sm text-muted-foreground">Nessun pasto o attività in questo giorno.</p>
        <div class="mt-3 flex justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="empty-add-meal"
            @click="chooseMeal"
          >
            <Utensils />
            + Pasto
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="empty-add-activity"
            @click="chooseActivity"
          >
            <Dumbbell />
            + Attività
          </Button>
        </div>
      </div>
    </template>
  </div>

  <Button
    type="button"
    size="icon-lg"
    data-testid="add-entry"
    aria-label="Aggiungi pasto o attività"
    class="fixed bottom-20 right-[max(1rem,calc(50%-20rem))] z-30 size-14 rounded-full shadow-lg"
    @click="openChooser"
  >
    <Plus class="size-6" />
  </Button>

  <div
    v-if="chooserOpen"
    data-testid="add-chooser"
    class="fixed inset-0 z-30"
    role="dialog"
    aria-modal="true"
    aria-label="Cosa vuoi aggiungere?"
    @click.self="closeChooser"
  >
    <div
      class="absolute bottom-36 right-[max(1rem,calc(50%-20rem))] flex flex-col items-end gap-2"
    >
      <Button
        type="button"
        variant="secondary"
        size="lg"
        data-testid="choose-activity"
        class="shadow-lg"
        @click="chooseActivity"
      >
        <Dumbbell />
        + Attività
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        data-testid="choose-meal"
        class="shadow-lg"
        @click="chooseMeal"
      >
        <Utensils />
        + Pasto
      </Button>
    </div>
  </div>

  <AddMealFlow
    v-if="addOpen"
    :date="selectedDate"
    :meal="editing"
    :favorites="favorites"
    @close="closeAdd"
    @saved="afterMealChange"
    @deleted="afterMealChange"
    @favorites-changed="loadFavorites"
  />

  <AddActivityFlow
    v-if="activityOpen"
    :date="selectedDate"
    :activity="editingActivity"
    @close="closeActivity"
    @saved="afterActivityChange"
    @deleted="afterActivityChange"
  />
</template>
