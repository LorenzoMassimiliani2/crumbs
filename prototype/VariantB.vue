<script setup lang="ts">
// PROTOTIPO — Variante B: timeline verticale, striscia macro, sheet di aggiunta.
import { CalendarDays, ChevronLeft, ChevronRight, Download, LogOut, Minus, Plus, Search, User, X } from '@lucide/vue'
import { computed, reactive, ref } from 'vue'

import {
  dayTotals, favorites, itemTotals, macroPercent, mealTotals, mealTypes, profile,
  round, searchFoods, suggestMealType, todayMeals, zeroTotals,
  type Food, type Meal, type MealItem,
} from './mock'

const meals = ref<Meal[]>(structuredClone(todayMeals))
const page = ref<'today' | 'profile'>('today')
const dayOffset = ref(0)
const baseDate = new Date(2026, 10, 5)

const dayLabel = computed(() => {
  const date = new Date(baseDate)
  date.setDate(date.getDate() + dayOffset.value)
  return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
})
const visibleMeals = computed(() => (dayOffset.value === 0 ? meals.value : []))
const totals = computed(() => dayTotals(visibleMeals.value))
const macro = computed(() => macroPercent(totals.value))
const remaining = computed(() => profile.targetKcal - totals.value.kcal)
const progress = computed(() => Math.min(100, Math.round((totals.value.kcal / profile.targetKcal) * 100)))

const showAdd = ref(false)
const query = ref('')
const draft = ref<MealItem[]>([])
const mealType = ref(suggestMealType(new Date().getHours()))
const note = ref('')
const toast = ref('')

const results = computed(() => (query.value.trim().length >= 2 ? searchFoods(query.value) : null))
const draftKcal = computed(() => draft.value.map(itemTotals).reduce((sum, item) => sum + item.kcal, 0))

function openAdd(type?: string) {
  mealType.value = mealTypes.find((item) => item.value === type) ?? suggestMealType(new Date().getHours())
  draft.value = []
  query.value = ''
  note.value = ''
  showAdd.value = true
}

function addFood(food: Food) {
  draft.value.push({ food, grams: 100 })
}

function changeGrams(item: MealItem, delta: number) {
  item.grams = Math.max(5, item.grams + delta)
}

function saveMeal() {
  if (draft.value.length === 0) return
  meals.value.push({
    id: String(Date.now()),
    type: mealType.value.value,
    label: mealType.value.label,
    time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    note: note.value.trim() || undefined,
    items: draft.value,
  })
  showAdd.value = false
  dayOffset.value = 0
  page.value = 'today'
  toast.value = 'Pasto salvato (finto)'
  window.setTimeout(() => (toast.value = ''), 1800)
}

const form = reactive({ ...profile })
const bmr = computed(() => {
  const birth = new Date(form.birthDate)
  const now = new Date(2026, 10, 5)
  let age = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) age -= 1
  return Math.round(10 * form.weightKg + 6.25 * form.heightCm - 5 * age + (form.sex === 'm' ? 5 : -161))
})
const bmi = computed(() => round(form.weightKg / ((form.heightCm / 100) ** 2), 1))

function fakeExport() {
  toast.value = 'Qui partirebbe l\'export .xlsx (finto)'
  window.setTimeout(() => (toast.value = ''), 1800)
}
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <header class="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold tracking-tight">Crumbs</span>
        <button type="button" class="flex items-center gap-1 text-[11px] text-muted-foreground">
          <LogOut class="size-3.5" />
          Esci
        </button>
      </div>
      <div class="mt-2 flex items-center justify-between">
        <button type="button" class="rounded-full p-1.5 text-muted-foreground hover:bg-muted" @click="dayOffset -= 1">
          <ChevronLeft class="size-4" />
        </button>
        <span class="flex items-center gap-1.5 text-xs font-medium capitalize">
          <CalendarDays class="size-3.5 text-muted-foreground" />
          {{ dayLabel }}
        </span>
        <button type="button" class="rounded-full p-1.5 text-muted-foreground hover:bg-muted" @click="dayOffset += 1">
          <ChevronRight class="size-4" />
        </button>
      </div>
    </header>

    <template v-if="page === 'today'">
      <div class="flex gap-2 overflow-x-auto px-4 py-3">
        <div class="shrink-0 rounded-xl bg-primary px-3 py-2 text-primary-foreground">
          <p class="text-[10px] uppercase tracking-wide opacity-80">Kcal</p>
          <p class="text-sm font-semibold tabular-nums">{{ Math.round(totals.kcal) }} / {{ profile.targetKcal }}</p>
        </div>
        <div class="shrink-0 rounded-xl border border-border bg-card px-3 py-2">
          <p class="text-[10px] uppercase tracking-wide text-muted-foreground">P</p>
          <p class="text-sm font-semibold tabular-nums">{{ Math.round(totals.protein) }} g</p>
          <p class="text-[10px] text-muted-foreground">{{ macro.protein }}%</p>
        </div>
        <div class="shrink-0 rounded-xl border border-border bg-card px-3 py-2">
          <p class="text-[10px] uppercase tracking-wide text-muted-foreground">C</p>
          <p class="text-sm font-semibold tabular-nums">{{ Math.round(totals.carbs) }} g</p>
          <p class="text-[10px] text-muted-foreground">{{ macro.carbs }}%</p>
        </div>
        <div class="shrink-0 rounded-xl border border-border bg-card px-3 py-2">
          <p class="text-[10px] uppercase tracking-wide text-muted-foreground">G</p>
          <p class="text-sm font-semibold tabular-nums">{{ Math.round(totals.fat) }} g</p>
          <p class="text-[10px] text-muted-foreground">{{ macro.fat }}%</p>
        </div>
      </div>

      <div class="px-4">
        <div class="h-1.5 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-primary" :style="{ width: progress + '%' }" />
        </div>
        <p class="mt-1.5 text-right text-[11px] text-muted-foreground tabular-nums">
          {{ Math.round(remaining) }} kcal rimanenti
        </p>
      </div>

      <main class="relative flex-1 px-4 pb-32 pt-4">
        <div class="absolute bottom-6 left-[3.15rem] top-3 w-px bg-border" />
        <div v-for="meal in visibleMeals" :key="meal.id" class="relative flex gap-3 pb-4">
          <div class="w-9 pt-1 text-right text-[11px] text-muted-foreground tabular-nums">{{ meal.time }}</div>
          <div class="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-background" />
          <div class="min-w-0 flex-1 rounded-xl border border-border bg-card p-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-xs font-semibold">{{ meal.label }}</p>
                <p class="text-[11px] text-muted-foreground tabular-nums">{{ Math.round(mealTotals(meal).kcal) }} kcal</p>
              </div>
              <button type="button" class="rounded-full bg-muted p-1 text-muted-foreground" @click="openAdd(meal.type)">
                <Plus class="size-3.5" />
              </button>
            </div>
            <ul class="mt-2 space-y-1">
              <li v-for="(item, index) in meal.items" :key="index" class="flex items-baseline justify-between gap-2 text-[11px]">
                <span class="truncate">{{ item.food.name }}</span>
                <span class="shrink-0 text-muted-foreground tabular-nums">{{ item.grams }} g</span>
              </li>
            </ul>
            <p v-if="meal.note" class="mt-2 text-[11px] italic text-muted-foreground">{{ meal.note }}</p>
          </div>
        </div>
        <div v-if="visibleMeals.length === 0" class="ml-12 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Nessun pasto in questo giorno.
        </div>
      </main>
    </template>

    <main v-else class="flex-1 px-4 pb-32 pt-4">
      <h1 class="text-lg font-semibold">Profilo</h1>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <div class="rounded-xl border border-border bg-card p-3">
          <p class="text-[10px] uppercase tracking-wide text-muted-foreground">BMR</p>
          <p class="text-lg font-semibold tabular-nums">{{ bmr }} kcal</p>
        </div>
        <div class="rounded-xl border border-border bg-card p-3">
          <p class="text-[10px] uppercase tracking-wide text-muted-foreground">BMI</p>
          <p class="text-lg font-semibold tabular-nums">{{ bmi }}</p>
        </div>
      </div>

      <div class="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        <label class="flex items-center justify-between px-3 py-2.5 text-xs">
          <span class="text-muted-foreground">Peso</span>
          <input v-model.number="form.weightKg" type="number" class="w-20 bg-transparent text-right tabular-nums outline-none" />
        </label>
        <label class="flex items-center justify-between px-3 py-2.5 text-xs">
          <span class="text-muted-foreground">Altezza</span>
          <input v-model.number="form.heightCm" type="number" class="w-20 bg-transparent text-right tabular-nums outline-none" />
        </label>
        <label class="flex items-center justify-between px-3 py-2.5 text-xs">
          <span class="text-muted-foreground">Sesso</span>
          <select v-model="form.sex" class="bg-transparent text-right outline-none">
            <option value="m">M</option>
            <option value="f">F</option>
          </select>
        </label>
        <label class="flex items-center justify-between px-3 py-2.5 text-xs">
          <span class="text-muted-foreground">Nascita</span>
          <input v-model="form.birthDate" type="date" class="bg-transparent text-right outline-none" />
        </label>
        <label class="flex items-center justify-between px-3 py-2.5 text-xs">
          <span class="text-muted-foreground">Target kcal</span>
          <input v-model.number="form.targetKcal" type="number" class="w-20 bg-transparent text-right tabular-nums outline-none" />
        </label>
      </div>

      <button type="button" class="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-3 text-xs" @click="fakeExport">
        <span>Esporta in Excel</span>
        <Download class="size-4 text-muted-foreground" />
      </button>

      <p class="mt-4 text-[10px] leading-relaxed text-muted-foreground">
        Dati da Open Food Facts (ODbL). Fonte alimenti generici: USDA FoodData Central (CC0).
      </p>
    </main>

    <nav class="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
      <div class="relative grid grid-cols-3">
        <button type="button" class="flex flex-col items-center gap-0.5 py-2.5 text-[10px]" :class="page === 'today' ? 'text-primary' : 'text-muted-foreground'" @click="page = 'today'">
          <CalendarDays class="size-5" />
          Oggi
        </button>
        <span />
        <button type="button" class="flex flex-col items-center gap-0.5 py-2.5 text-[10px]" :class="page === 'profile' ? 'text-primary' : 'text-muted-foreground'" @click="page = 'profile'">
          <User class="size-5" />
          Profilo
        </button>
        <button type="button" class="absolute left-1/2 top-0 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg" @click="openAdd()">
          <Plus class="size-5" />
        </button>
      </div>
    </nav>

    <div v-if="showAdd" class="fixed inset-0 z-40 flex items-end justify-center bg-black/40" @click.self="showAdd = false">
      <div class="flex max-h-[90svh] w-full max-w-[430px] flex-col rounded-t-2xl bg-background">
        <div class="flex items-center justify-between border-b border-border px-4 pb-2 pt-3">
          <span class="h-1 w-10 rounded-full bg-muted" />
          <p class="text-xs font-semibold">Nuovo pasto</p>
          <button type="button" class="text-muted-foreground" @click="showAdd = false"><X class="size-4" /></button>
        </div>

        <div class="flex-1 space-y-3 overflow-y-auto px-4 pb-36 pt-3">
          <div class="flex gap-1.5 overflow-x-auto pb-1">
            <button
              v-for="type in mealTypes"
              :key="type.value"
              type="button"
              class="shrink-0 rounded-full border px-2.5 py-1 text-[11px]"
              :class="mealType.value === type.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'"
              @click="mealType = type"
            >
              {{ type.label }}
            </button>
          </div>

          <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input v-model="query" type="search" placeholder="Cerca" class="w-full rounded-lg border border-border bg-muted/40 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary" />
          </div>

          <div v-if="!results" class="space-y-1.5">
            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Preferiti</p>
            <button v-for="food in favorites" :key="food.id" type="button" class="flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-2 text-left text-xs" @click="addFood(food)">
              <span class="min-w-0">
                <span class="block truncate">{{ food.name }}</span>
                <span class="block text-[10px] text-muted-foreground">{{ Math.round(food.kcal) }} kcal/100 g</span>
              </span>
              <Plus class="size-3.5 text-muted-foreground" />
            </button>
          </div>

          <template v-else>
            <div v-if="results.off.length" class="space-y-1.5">
              <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Prodotti confezionati</p>
              <button v-for="food in results.off" :key="food.id" type="button" class="flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-2 text-left text-xs" @click="addFood(food)">
                <span class="min-w-0">
                  <span class="block truncate">{{ food.name }}</span>
                  <span class="block text-[10px] text-muted-foreground">{{ food.brand }} · {{ Math.round(food.kcal) }} kcal/100 g</span>
                </span>
                <Plus class="size-3.5 text-muted-foreground" />
              </button>
            </div>
            <div v-if="results.usda.length" class="space-y-1.5">
              <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Alimenti generici</p>
              <button v-for="food in results.usda" :key="food.id" type="button" class="flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-2 text-left text-xs" @click="addFood(food)">
                <span class="min-w-0">
                  <span class="block truncate">{{ food.name }}</span>
                  <span class="block text-[10px] text-muted-foreground">USDA · {{ Math.round(food.kcal) }} kcal/100 g</span>
                </span>
                <Plus class="size-3.5 text-muted-foreground" />
              </button>
            </div>
            <p v-if="!results.off.length && !results.usda.length" class="rounded-lg border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
              Nessun risultato. Crea l'alimento a mano.
            </p>
          </template>

          <div v-if="draft.length" class="space-y-1.5">
            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Nel pasto</p>
            <div v-for="(item, index) in draft" :key="index" class="flex items-center justify-between rounded-lg border border-border px-2.5 py-2">
              <div class="min-w-0">
                <p class="truncate text-xs">{{ item.food.name }}</p>
                <p class="text-[10px] text-muted-foreground tabular-nums">{{ Math.round(itemTotals(item).kcal) }} kcal</p>
              </div>
              <div class="flex items-center gap-1">
                <button type="button" class="rounded-full border border-border p-0.5" @click="changeGrams(item, -10)"><Minus class="size-3" /></button>
                <input v-model.number="item.grams" type="number" class="w-12 rounded border border-border bg-background px-1 py-0.5 text-center text-[11px] tabular-nums" />
                <button type="button" class="rounded-full border border-border p-0.5" @click="changeGrams(item, 10)"><Plus class="size-3" /></button>
                <button type="button" class="ml-1 text-muted-foreground" @click="draft.splice(index, 1)"><X class="size-3.5" /></button>
              </div>
            </div>
            <input v-model="note" type="text" placeholder="Nota (opzionale)" class="w-full rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-xs outline-none focus:border-primary" />
          </div>
        </div>

        <div class="border-t border-border px-4 py-3">
          <div class="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>{{ draft.length }} alimenti</span>
            <span class="tabular-nums">{{ Math.round(draftKcal) }} kcal</span>
          </div>
          <button type="button" class="w-full rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40" :disabled="draft.length === 0" @click="saveMeal">
            Salva pasto
          </button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-[132px] left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs text-background shadow-lg">
      {{ toast }}
    </div>
  </div>
</template>
