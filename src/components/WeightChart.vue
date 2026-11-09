<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  formatWeight,
  formatWeightDate,
  weightChartModel,
  WEIGHT_CHART_PERIODS,
  type WeightChartPeriod,
  type WeightEntry,
} from '@/lib/weight'

const props = defineProps<{ entries: WeightEntry[]; today: string }>()

const period = ref<WeightChartPeriod>(90)
const model = computed(() => weightChartModel(props.entries, period.value, props.today))

const WIDTH = 320
const HEIGHT = 180
const PLOT = { left: 44, right: 10, top: 12, bottom: 26 }
const plotWidth = WIDTH - PLOT.left - PLOT.right
const plotHeight = HEIGHT - PLOT.top - PLOT.bottom

function px(x: number): number {
  return PLOT.left + x * plotWidth
}

function py(y: number): number {
  return PLOT.top + y * plotHeight
}

const polyline = computed(() =>
  model.value.points.map((point) => `${px(point.x).toFixed(2)},${py(point.y).toFixed(2)}`).join(' '),
)

const chartLabel = computed(() => {
  const count = model.value.points.length
  return `Andamento del peso, ${count} ${count === 1 ? 'misura' : 'misure'} nel periodo`
})

const shortDateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function shortDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return shortDateFormatter.format(new Date(year, month - 1, day))
}
</script>

<template>
  <section class="rounded-2xl border border-border bg-card p-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-medium">Andamento</h2>
      <div role="group" aria-label="Periodo del grafico" class="flex gap-1">
        <button
          v-for="option in WEIGHT_CHART_PERIODS"
          :key="option.value"
          type="button"
          :data-testid="`chart-period-${option.value}`"
          :aria-pressed="period === option.value"
          class="rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors"
          :class="
            period === option.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:text-foreground'
          "
          @click="period = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <svg
      v-if="model.points.length > 0"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      class="mt-3 h-auto w-full text-primary"
      role="img"
      :aria-label="chartLabel"
    >
      <title>{{ chartLabel }}</title>

      <line
        :x1="PLOT.left"
        :y1="py(1)"
        :x2="WIDTH - PLOT.right"
        :y2="py(1)"
        stroke="currentColor"
        stroke-opacity="0.2"
        stroke-width="1"
      />

      <text
        :x="PLOT.left - 6"
        :y="py(0) + 4"
        text-anchor="end"
        class="fill-muted-foreground text-[10px] tabular-nums"
      >
        {{ formatWeight(model.yMax) }}
      </text>
      <text
        :x="PLOT.left - 6"
        :y="py(1)"
        text-anchor="end"
        class="fill-muted-foreground text-[10px] tabular-nums"
      >
        {{ formatWeight(model.yMin) }}
      </text>

      <polyline
        :points="polyline"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <circle
        v-for="point in model.points"
        :key="point.date"
        :cx="px(point.x)"
        :cy="py(point.y)"
        r="4"
        fill="currentColor"
      >
        <title>{{ formatWeightDate(point.date) }}: {{ formatWeight(point.weight) }} kg</title>
      </circle>

      <text
        :x="PLOT.left"
        :y="HEIGHT - 6"
        text-anchor="start"
        class="fill-muted-foreground text-[10px]"
      >
        {{ shortDate(model.points[0]!.date) }}
      </text>
      <text
        :x="WIDTH - PLOT.right"
        :y="HEIGHT - 6"
        text-anchor="end"
        class="fill-muted-foreground text-[10px]"
      >
        {{ shortDate(model.points.at(-1)!.date) }}
      </text>
    </svg>

    <p v-else data-testid="chart-empty" class="mt-3 text-sm text-muted-foreground">
      Nessuna misura nel periodo selezionato.
    </p>
  </section>
</template>
