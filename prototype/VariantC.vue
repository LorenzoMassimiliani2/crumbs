<script setup lang="ts">
// PROTOTIPO — Variante C: dashboard con anello kcal, card espandibili, ricerca come tab.
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, LogOut, Plus, Search, User, X } from '@lucide/vue'
import { computed, reactive, ref } from 'vue'

import {
  dayTotals, favorites, itemTotals, macroPercent, mealTotals, mealTypes, profile,
  round, searchFoods, suggestMealType, todayMeals,
  type Food, type Meal, type MealItem,
} from './mock'

const meals = ref<Meal[]>(structuredClone(todayMeals))
const page = ref<'today' | 'search' | 'profile'>('today')
const dayOffset = ref(0)
const baseDate = new Date(2026, 10, 5)
const openMeal = ref<string | null>('m1')

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
const ringOffset = computed(() => 327 * (1 - progress.value / 100))

const query = ref('')
const draft = ref<MealItem[]>([])
const mealType = ref(suggestMealType(new Date().getHours()))
const note = ref('')
const toast = ref('')

const results = computed(() => (query.value.trim().length >= 2 ? searchFoods(query.value) : null))
const draftKcal = computed(() => draft.value.map(itemTotals).reduce((sum, item) => sum + item.kcal, 0))

function addFood(food: Food) {
  draft.value.push({ food, grams: 100 })
  toast.value = food.name + ' aggiunto alla bozza'
  window.setTimeout(() => (toast.value = ''), 1200)
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
  draft.value = []
  note.value = ''
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
        <div>
          <p class="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Crumbs</p>
          <p class="text-sm font-semibold capitalize">{{ dayLabel }}</p>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" class="rounded-full p-1.5 text-muted-foreground hover:bg-muted" @click="dayOffset -= 1"><ChevronLeft class="size-4" /></button>
          <button type="button" class="rounded-full p-1.5 text-muted-foreground hover:bg-muted" @click="dayOffset += 1"><ChevronRight class="size-4" /></button>
          <button type="button" class="ml-1 rounded-full p-1.5 text-muted-foreground hover:bg-muted"><LogOut class="size-4" /></button>
        </div>
      </div>
    </header>

    <main v-if="page === 'today'" class="flex-1 px-4 pb-36 pt-4">
      <section class="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        <div class="relative size-28 shrink-0">
          <svg viewBox="0 0 120 120" class="size-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" class="text-muted" stroke-width="10" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" class="text-primary transition-all" stroke-width="10" stroke-linecap="round" :stroke-dasharray="327" :stroke-dashoffset="ringOffset" />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-xl font-semibold tabular-nums">{{ Math.round(remaining) }}</span>
            <span class="text-[10px] text-muted-foreground">kcal rimaste</span>
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs text-muted-foreground">Consumate</p>
          <p class="text-lg font-semibold tabular-nums">{{ Math.round(totals.kcal) }} <span class="text-xs font-normal text-muted-foreground">/ {{ profile.targetKcal }} kcal</span></p>
          <div class="mt-2 space-y-1 text-[11px]">
            <div class="flex justify-between"><span class="text-muted-foreground">Proteine</span><span class="tabular-nums">{{ Math.round(totals.protein) }} g · {{ macro.protein }}%</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Carboidrati</span><span class="tabular-nums">{{ Math.round(totals.carbs) }} g · {{ macro.carbs }}%</span></div>
            <div class="flex justify-between"><span class="text-muted-foreground">Grassi</span><span class="tabular-nums">{{ Math.round(totals.fat) }} g · {{ macro.fat }}%</span></div>
          </div>
        </div>
      </section>

      <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
        <div v-for="macroItem in [
          { label: 'Proteine', value: totals.protein, pct: macro.protein, color: 'bg-sky-500' },
          { label: 'Carboidrati', value: totals.carbs, pct: macro.carbs, color: 'bg-amber-500' },
          { label: 'Grassi', value: totals.fat, pct: macro.fat, color: 'bg-rose-500' },
          { label: 'Fibre', value: totals.fiber, pct: null, color: 'bg-emerald-500' },
        ]" :key="macroItem.label" class="w-28 shrink-0 rounded-xl border border-border bg-card p-3">
          <p class="text-[10px] uppercase tracking-wide text-muted-foreground">{{ macroItem.label }}</p>
          <p class="mt-1 text-sm font-semibold tabular-nums">{{ Math.round(macroItem.value) }} g</p>
          <div class="mt-2 h-1 rounded-full bg-muted">
            <div class="h-full rounded-full" :class="macroItem.color" :style="{ width: Math.min(100, Math.round(macroItem.value * 2)) + '%' }" />
          </div>
          <p class="mt-1 text-[10px] text-muted-foreground">{{ macroItem.pct === null ? '—' : macroItem.pct + '% kcal' }}</p>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold">Pasti</h2>
        <button type="button" class="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground" @click="page = 'search'">
          <Plus class="size-3.5" />
          Aggiungi
        </button>
      </div>

      <div class="mt-2 space-y-2">
        <article v-for="meal in visibleMeals" :key="meal.id" class="overflow-hidden rounded-xl border border-border bg-card">
          <button type="button" class="flex w-full items-center justify-between px-3 py-3 text-left" @click="openMeal = openMeal === meal.id ? null : meal.id">
            <div class="flex items-center gap-3">
              <div class="flex size-9 flex-col items-center justify-center rounded-lg bg-muted/70">
                <span class="text-[10px] font-semibold tabular-nums">{{ meal.time }}</span>
              </div>
              <div>
                <p class="text-sm font-medium">{{ meal.label }}</p>
                <p class="text-[11px] text-muted-foreground">{{ meal.items.length }} alimenti · {{ Math.round(mealTotals(meal).kcal) }} kcal</p>
              </div>
            </div>
            <ChevronDown class="size-4 text-muted-foreground transition-transform" :class="openMeal === meal.id ? 'rotate-180' : ''" />
          </button>
          <div v-if="openMeal === meal.id" class="border-t border-border/70 px-3 pb-3 pt-2">
            <ul class="space-y-1.5">
              <li v-for="(item, index) in meal.items" :key="index" class="flex items-baseline justify-between gap-2 text-xs">
                <span class="truncate">{{ item.food.name }}</span>
                <span class="shrink-0 text-muted-foreground tabular-nums">{{ item.grams }} g · {{ Math.round(itemTotals(item).kcal) }} kcal</span>
              </li>
            </ul>
            <p v-if="meal.note" class="mt-2 text-[11px] italic text-muted-foreground">{{ meal.note }}</p>
            <div class="mt-2 flex gap-2">
              <button type="button" class="flex-1 rounded-lg border border-border py-1.5 text-[11px]">Modifica</button>
              <button type="button" class="rounded-lg border border-border px-3 py-1.5 text-[11px] text-destructive">Elimina</button>
            </div>
          </div>
        </article>
        <div v-if="visibleMeals.length === 0" class="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          Nessun pasto in questo giorno.
        </div>
      </div>
    </main>

    <main v-else-if="page === 'search'" class="flex-1 px-4 pb-40 pt-4">
      <h1 class="text-lg font-semibold">Aggiungi alimenti</h1>
      <div class="relative mt-3">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input v-model="query" type="search" placeholder="Cerca alimento o prodotto" class="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" />
      </div>

      <div v-if="!results" class="mt-4">
        <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Preferiti</p>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <button v-for="food in favorites" :key="food.id" type="button" class="rounded-xl border border-border bg-card p-3 text-left" @click="addFood(food)">
            <p class="truncate text-xs font-medium">{{ food.name }}</p>
            <p class="mt-0.5 text-[10px] text-muted-foreground">{{ food.brand ?? 'USDA' }} · {{ Math.round(food.kcal) }} kcal</p>
          </button>
        </div>
      </div>

      <div v-else class="mt-4 space-y-4">
        <div v-if="results.off.length">
          <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Prodotti confezionati</p>
          <div class="mt-2 space-y-1.5">
            <button v-for="food in results.off" :key="food.id" type="button" class="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left" @click="addFood(food)">
              <span class="min-w-0">
                <span class="block truncate text-xs">{{ food.name }}</span>
                <span class="block text-[10px] text-muted-foreground">{{ food.brand }} · {{ Math.round(food.kcal) }} kcal/100 g</span>
              </span>
              <Plus class="size-4 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div v-if="results.usda.length">
          <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Alimenti generici</p>
          <div class="mt-2 space-y-1.5">
            <button v-for="food in results.usda" :key="food.id" type="button" class="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left" @click="addFood(food)">
              <span class="min-w-0">
                <span class="block truncate text-xs">{{ food.name }}</span>
                <span class="block text-[10px] text-muted-foreground">USDA · {{ Math.round(food.kcal) }} kcal/100 g</span>
              </span>
              <Plus class="size-4 text-muted-foreground" />
            </button>
          </div>
        </div>
        <p v-if="!results.off.length && !results.usda.length" class="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Nessun risultato. Crea l'alimento a mano.
        </p>
      </div>

      <button type="button" class="mt-4 w-full rounded-xl border border-dashed border-border py-2.5 text-xs text-muted-foreground">
        + Crea alimento manuale
      </button>
    </main>

    <main v-else class="flex-1 px-4 pb-36 pt-4">
      <h1 class="text-lg font-semibold">Profilo</h1>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <div class="rounded-xl border border-border bg-card p-3">
          <p class="text-[10px] uppercase tracking-wide text-muted-foreground">BMR stimato</p>
          <p class="text-lg font-semibold tabular-nums">{{ bmr }} kcal</p>
        </div>
        <div class="rounded-xl border border-border bg-card p-3">
          <p class="text-[10px] uppercase tracking-wide text-muted-foreground">BMI</p>
          <p class="text-lg font-semibold tabular-nums">{{ bmi }}</p>
        </div>
      </div>

      <div class="mt-3 rounded-xl border border-border bg-card p-3">
        <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Target kcal</p>
        <div class="mt-1 flex items-baseline gap-2">
          <input v-model.number="form.targetKcal" type="number" class="w-24 bg-transparent text-2xl font-semibold tabular-nums outline-none" />
          <span class="text-xs text-muted-foreground">kcal / giorno</span>
        </div>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2">
        <label class="rounded-xl border border-border bg-card p-3">
          <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Peso</span>
          <input v-model.number="form.weightKg" type="number" class="mt-1 w-full bg-transparent text-sm font-medium tabular-nums outline-none" />
        </label>
        <label class="rounded-xl border border-border bg-card p-3">
          <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Altezza</span>
          <input v-model.number="form.heightCm" type="number" class="mt-1 w-full bg-transparent text-sm font-medium tabular-nums outline-none" />
        </label>
        <label class="rounded-xl border border-border bg-card p-3">
          <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Sesso</span>
          <select v-model="form.sex" class="mt-1 w-full bg-transparent text-sm font-medium outline-none">
            <option value="m">M</option>
            <option value="f">F</option>
          </select>
        </label>
        <label class="rounded-xl border border-border bg-card p-3">
          <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Nascita</span>
          <input v-model="form.birthDate" type="date" class="mt-1 w-full bg-transparent text-sm font-medium outline-none" />
        </label>
      </div>

      <button type="button" class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-xs" @click="fakeExport">
        <Download class="size-4" />
        Esporta in Excel
      </button>

      <p class="mt-4 text-[10px] leading-relaxed text-muted-foreground">
        Dati da Open Food Facts (ODbL). Fonte alimenti generici: USDA FoodData Central (CC0).
      </p>
    </main>

    <div v-if="draft.length" class="fixed bottom-16 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 px-3">
      <div class="rounded-xl border border-border bg-card p-3 shadow-lg">
        <div class="flex items-center justify-between text-[11px]">
          <span>{{ draft.length }} alimenti · {{ Math.round(draftKcal) }} kcal</span>
          <select v-model="mealType" class="rounded border border-border bg-background px-1.5 py-0.5 text-[11px]">
            <option v-for="type in mealTypes" :key="type.value" :value="type">{{ type.label }}</option>
          </select>
        </div>
        <div class="mt-2 max-h-28 space-y-1 overflow-y-auto">
          <div v-for="(item, index) in draft" :key="index" class="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1">
            <span class="truncate text-[11px]">{{ item.food.name }}</span>
            <div class="flex items-center gap-1">
              <input v-model.number="item.grams" type="number" class="w-12 rounded border border-border bg-background px-1 text-center text-[10px] tabular-nums" />
              <span class="text-[10px] text-muted-foreground">g</span>
              <button type="button" class="text-muted-foreground" @click="draft.splice(index, 1)"><X class="size-3" /></button>
            </div>
          </div>
        </div>
        <input v-model="note" type="text" placeholder="Nota (opzionale)" class="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] outline-none" />
        <button type="button" class="mt-2 w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground" @click="saveMeal">
          Salva pasto
        </button>
      </div>
    </div>

    <nav class="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
      <div class="grid grid-cols-3">
        <button type="button" class="flex flex-col items-center gap-0.5 py-2.5 text-[10px]" :class="page === 'today' ? 'text-primary' : 'text-muted-foreground'" @click="page = 'today'">
          <CalendarDays class="size-5" />
          Oggi
        </button>
        <button type="button" class="flex flex-col items-center gap-0.5 py-2.5 text-[10px]" :class="page === 'search' ? 'text-primary' : 'text-muted-foreground'" @click="page = 'search'">
          <Search class="size-5" />
          Cerca
        </button>
        <button type="button" class="flex flex-col items-center gap-0.5 py-2.5 text-[10px]" :class="page === 'profile' ? 'text-primary' : 'text-muted-foreground'" @click="page = 'profile'">
          <User class="size-5" />
          Profilo
        </button>
      </div>
    </nav>

    <div v-if="toast" class="fixed bottom-[132px] left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs text-background shadow-lg">
      {{ toast }}
    </div>
  </div>
</template>
