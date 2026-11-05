<script setup lang="ts">
// PROTOTIPO — Variante A: diario classico, sezioni per pasto, FAB.
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
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
})
const visibleMeals = computed(() => (dayOffset.value === 0 ? meals.value : []))
const totals = computed(() => dayTotals(visibleMeals.value))
const target = profile.targetKcal
const remaining = computed(() => target - totals.value.kcal)
const progress = computed(() => Math.min(100, Math.round((totals.value.kcal / target) * 100)))
const macro = computed(() => macroPercent(totals.value))

const showAdd = ref(false)
const query = ref('')
const draft = ref<MealItem[]>([])
const mealType = ref(suggestMealType(new Date().getHours()))
const note = ref('')
const toast = ref('')

const results = computed(() => (query.value.trim().length >= 2 ? searchFoods(query.value) : null))
const draftTotals = computed(() => draft.value.map(itemTotals).reduce(
  (acc, value) => ({
    kcal: acc.kcal + value.kcal,
    protein: acc.protein + value.protein,
    carbs: acc.carbs + value.carbs,
    fat: acc.fat + value.fat,
    fiber: acc.fiber + value.fiber,
    sugar: acc.sugar + value.sugar,
    salt: acc.salt + value.salt,
  }),
  zeroTotals(),
))

function openAdd(type?: string) {
  const chosen = mealTypes.find((item) => item.value === type) ?? suggestMealType(new Date().getHours())
  mealType.value = chosen
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
const age = computed(() => {
  const birth = new Date(form.birthDate)
  const now = new Date(2026, 10, 5)
  let years = now.getFullYear() - birth.getFullYear()
  const months = now.getMonth() - birth.getMonth()
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) years -= 1
  return years
})
const bmr = computed(() => Math.round(
  10 * form.weightKg + 6.25 * form.heightCm - 5 * age.value + (form.sex === 'm' ? 5 : -161),
))
const bmi = computed(() => round(form.weightKg / ((form.heightCm / 100) ** 2), 1))

function fakeExport() {
  toast.value = 'Qui partirebbe l\'export .xlsx (finto)'
  window.setTimeout(() => (toast.value = ''), 1800)
}
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <header class="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div class="flex h-14 items-center justify-between px-4">
        <div class="flex items-center gap-2">
          <span class="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">C</span>
          <span class="text-base font-semibold tracking-tight">Crumbs</span>
        </div>
        <button type="button" class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LogOut class="size-4" />
          Esci
        </button>
      </div>
    </header>

    <main v-if="page === 'today'" class="flex-1 space-y-4 px-4 pb-28 pt-4">
      <div class="flex items-center justify-between">
        <button type="button" class="rounded-full p-2 text-muted-foreground hover:bg-muted" @click="dayOffset -= 1">
          <ChevronLeft class="size-5" />
        </button>
        <div class="flex items-center gap-2 text-center">
          <CalendarDays class="size-4 text-muted-foreground" />
          <span class="text-sm font-medium capitalize">{{ dayLabel }}</span>
        </div>
        <button type="button" class="rounded-full p-2 text-muted-foreground hover:bg-muted" @click="dayOffset += 1">
          <ChevronRight class="size-5" />
        </button>
      </div>

      <section class="rounded-2xl border border-border bg-card p-4">
        <div class="flex items-end justify-between">
          <div>
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Rimanenti</p>
            <p class="text-3xl font-semibold tabular-nums">
              {{ Math.round(remaining) }}
              <span class="text-sm font-normal text-muted-foreground">kcal</span>
            </p>
          </div>
          <p class="text-xs text-muted-foreground tabular-nums">{{ Math.round(totals.kcal) }} / {{ target }} kcal</p>
        </div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-primary transition-all" :style="{ width: progress + '%' }" />
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
          <div v-for="macroItem in [
            { label: 'Proteine', value: totals.protein, pct: macro.protein },
            { label: 'Carboidrati', value: totals.carbs, pct: macro.carbs },
            { label: 'Grassi', value: totals.fat, pct: macro.fat },
          ]" :key="macroItem.label" class="rounded-xl bg-muted/60 py-2">
            <p class="text-sm font-semibold tabular-nums">{{ Math.round(macroItem.value) }} g</p>
            <p class="text-[11px] text-muted-foreground">{{ macroItem.label }} · {{ macroItem.pct }}%</p>
          </div>
        </div>
      </section>

      <section v-for="meal in visibleMeals" :key="meal.id" class="rounded-2xl border border-border bg-card">
        <div class="flex items-center justify-between px-4 pt-4">
          <div>
            <p class="text-sm font-semibold">{{ meal.label }}</p>
            <p class="text-[11px] text-muted-foreground">{{ meal.time }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground tabular-nums">{{ Math.round(mealTotals(meal).kcal) }} kcal</span>
            <button type="button" class="rounded-full bg-muted p-1.5 text-muted-foreground hover:bg-muted/70" @click="openAdd(meal.type)">
              <Plus class="size-4" />
            </button>
          </div>
        </div>
        <ul class="mt-2 divide-y divide-border/70 px-4 pb-3">
          <li v-for="(item, index) in meal.items" :key="index" class="flex items-center justify-between py-2">
            <div class="min-w-0">
              <p class="truncate text-sm">{{ item.food.name }}</p>
              <p class="text-[11px] text-muted-foreground">{{ item.grams }} g · {{ item.food.source === 'off' ? item.food.brand ?? 'Open Food Facts' : item.food.source === 'usda' ? 'USDA' : 'Manuale' }}</p>
            </div>
            <span class="text-sm text-muted-foreground tabular-nums">{{ Math.round(itemTotals(item).kcal) }} kcal</span>
          </li>
        </ul>
        <p v-if="meal.note" class="border-t border-border/70 px-4 py-2 text-[11px] italic text-muted-foreground">{{ meal.note }}</p>
      </section>

      <div v-if="visibleMeals.length === 0" class="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nessun pasto in questo giorno.
      </div>
    </main>

    <main v-else class="flex-1 space-y-4 px-4 pb-28 pt-4">
      <h1 class="text-xl font-semibold">Profilo</h1>
      <section class="grid grid-cols-2 gap-3">
        <div class="rounded-2xl border border-border bg-card p-4">
          <p class="text-[11px] uppercase tracking-wide text-muted-foreground">BMR stimato</p>
          <p class="text-2xl font-semibold tabular-nums">{{ bmr }} <span class="text-xs font-normal text-muted-foreground">kcal</span></p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-4">
          <p class="text-[11px] uppercase tracking-wide text-muted-foreground">BMI</p>
          <p class="text-2xl font-semibold tabular-nums">{{ bmi }}</p>
        </div>
      </section>

      <section class="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 class="text-sm font-semibold">Dati</h2>
        <label class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted-foreground">Peso</span>
          <input v-model.number="form.weightKg" type="number" class="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-right tabular-nums" />
        </label>
        <label class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted-foreground">Altezza</span>
          <input v-model.number="form.heightCm" type="number" class="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-right tabular-nums" />
        </label>
        <label class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted-foreground">Sesso</span>
          <select v-model="form.sex" class="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-right">
            <option value="m">M</option>
            <option value="f">F</option>
          </select>
        </label>
        <label class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted-foreground">Nascita</span>
          <input v-model="form.birthDate" type="date" class="rounded-lg border border-border bg-background px-3 py-1.5 text-right" />
        </label>
      </section>

      <section class="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <div>
          <p class="text-sm font-semibold">Target giornaliero</p>
          <p class="text-[11px] text-muted-foreground">Inserito a mano</p>
        </div>
        <div class="flex items-baseline gap-1">
          <input v-model.number="form.targetKcal" type="number" class="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-right tabular-nums" />
          <span class="text-xs text-muted-foreground">kcal</span>
        </div>
      </section>

      <button type="button" class="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium" @click="fakeExport">
        <Download class="size-4" />
        Esporta in Excel
      </button>

      <p class="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Dati da Open Food Facts (ODbL). Fonte alimenti generici: USDA FoodData Central (CC0).
      </p>
    </main>

    <nav class="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
      <div class="grid grid-cols-2">
        <button type="button" class="flex flex-col items-center gap-0.5 py-2.5 text-[11px]" :class="page === 'today' ? 'text-primary' : 'text-muted-foreground'" @click="page = 'today'">
          <CalendarDays class="size-5" />
          Oggi
        </button>
        <button type="button" class="flex flex-col items-center gap-0.5 py-2.5 text-[11px]" :class="page === 'profile' ? 'text-primary' : 'text-muted-foreground'" @click="page = 'profile'">
          <User class="size-5" />
          Profilo
        </button>
      </div>
    </nav>

    <button
      v-if="page === 'today'"
      type="button"
      class="fixed bottom-20 right-[max(1rem,calc(50%-199px))] z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
      @click="openAdd()"
    >
      <Plus class="size-6" />
    </button>

    <div v-if="showAdd" class="fixed inset-0 z-40 flex justify-center bg-black/40">
      <div class="flex h-full w-full max-w-[430px] flex-col bg-background">
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <button type="button" class="rounded-full p-2 text-muted-foreground hover:bg-muted" @click="showAdd = false">
            <X class="size-5" />
          </button>
          <p class="text-sm font-semibold">Aggiungi pasto</p>
          <span class="w-9" />
        </header>

        <div class="flex-1 space-y-4 overflow-y-auto px-4 pb-40 pt-4">
          <div class="flex gap-2 overflow-x-auto pb-1">
            <button
              v-for="type in mealTypes"
              :key="type.value"
              type="button"
              class="shrink-0 rounded-full border px-3 py-1.5 text-xs"
              :class="mealType.value === type.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'"
              @click="mealType = type"
            >
              {{ type.label }}
            </button>
          </div>

          <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input v-model="query" type="search" placeholder="Cerca alimento o prodotto" class="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>

          <div v-if="!results" class="space-y-2">
            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preferiti</p>
            <button v-for="food in favorites" :key="food.id" type="button" class="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left" @click="addFood(food)">
              <span class="min-w-0">
                <span class="block truncate text-sm">{{ food.name }}</span>
                <span class="block text-[11px] text-muted-foreground">{{ food.brand ?? (food.source === 'usda' ? 'USDA' : 'Manuale') }} · {{ Math.round(food.kcal) }} kcal/100 g</span>
              </span>
              <Plus class="size-4 text-muted-foreground" />
            </button>
          </div>

          <template v-else>
            <div v-if="results.off.length" class="space-y-2">
              <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prodotti confezionati</p>
              <button v-for="food in results.off" :key="food.id" type="button" class="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left" @click="addFood(food)">
                <span class="min-w-0">
                  <span class="block truncate text-sm">{{ food.name }}</span>
                  <span class="block text-[11px] text-muted-foreground">{{ food.brand }} · {{ Math.round(food.kcal) }} kcal/100 g</span>
                </span>
                <Plus class="size-4 text-muted-foreground" />
              </button>
            </div>
            <div v-if="results.usda.length" class="space-y-2">
              <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Alimenti generici</p>
              <button v-for="food in results.usda" :key="food.id" type="button" class="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left" @click="addFood(food)">
                <span class="min-w-0">
                  <span class="block truncate text-sm">{{ food.name }}</span>
                  <span class="block text-[11px] text-muted-foreground">USDA · {{ Math.round(food.kcal) }} kcal/100 g</span>
                </span>
                <Plus class="size-4 text-muted-foreground" />
              </button>
            </div>
            <p v-if="!results.off.length && !results.usda.length" class="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Nessun risultato. Puoi creare l'alimento a mano.
            </p>
          </template>

          <div v-if="draft.length" class="space-y-2">
            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Nel pasto</p>
            <div v-for="(item, index) in draft" :key="index" class="rounded-xl border border-border bg-card px-3 py-2.5">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate text-sm">{{ item.food.name }}</p>
                  <p class="text-[11px] text-muted-foreground">{{ Math.round(itemTotals(item).kcal) }} kcal</p>
                </div>
                <button type="button" class="text-muted-foreground" @click="draft.splice(index, 1)">
                  <X class="size-4" />
                </button>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <button type="button" class="rounded-full border border-border p-1" @click="changeGrams(item, -10)"><Minus class="size-3.5" /></button>
                <input v-model.number="item.grams" type="number" class="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm tabular-nums" />
                <span class="text-xs text-muted-foreground">g</span>
                <button type="button" class="rounded-full border border-border p-1" @click="changeGrams(item, 10)"><Plus class="size-3.5" /></button>
              </div>
            </div>
            <input v-model="note" type="text" placeholder="Nota (opzionale)" class="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm outline-none focus:border-primary" />
          </div>
        </div>

        <footer class="sticky bottom-0 border-t border-border bg-background px-4 py-3">
          <div class="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ draft.length }} alimenti</span>
            <span class="tabular-nums">{{ Math.round(draftTotals.kcal) }} kcal</span>
          </div>
          <button type="button" class="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40" :disabled="draft.length === 0" @click="saveMeal">
            Salva pasto
          </button>
        </footer>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-[132px] left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs text-background shadow-lg">
      {{ toast }}
    </div>
  </div>
</template>
