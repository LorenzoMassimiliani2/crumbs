<script setup lang="ts">
import { SlidersHorizontal } from '@lucide/vue'
import { computed, ref } from 'vue'

import { formatKcal, formatNumber } from '@/lib/diary'
import { trendOptions, type TrendChartType } from '@/composables/trendState'
import { buildTrend, type Stats, type TrendBar, type TrendView } from '@/lib/stats'

const props = defineProps<{ stats: Stats; today: string; view: TrendView }>()
const emit = defineEmits<{ select: [date: string]; 'update:view': [view: TrendView] }>()

const VIEW_OPTIONS: { value: TrendView; label: string }[] = [
  { value: 'day', label: 'Giorno' },
  { value: 'week', label: 'Settimana' },
  { value: 'month', label: 'Mese' },
]

const model = computed(() => buildTrend(props.stats, props.view, props.today))

const WIDTH = 420
const HEIGHT = 200
const PLOT = { left: 40, right: 8, top: 16, bottom: 26 }
const plotWidth = WIDTH - PLOT.left - PLOT.right
const plotHeight = HEIGHT - PLOT.top - PLOT.bottom

const barX = (bar: TrendBar): number => PLOT.left + bar.x * plotWidth
const barWidth = (bar: TrendBar): number => bar.width * plotWidth
const barY = (bar: TrendBar): number => PLOT.top + (1 - bar.height) * plotHeight
const barHeight = (bar: TrendBar): number => bar.height * plotHeight

function slotX(index: number): number {
  return PLOT.left + ((index + 0.5) / model.value.days.length) * plotWidth
}

const targetY = computed(() =>
  model.value.targetY === null ? null : PLOT.top + (1 - model.value.targetY) * plotHeight,
)

const changeLabel = computed(() => {
  const suffix = model.value.changeLabel
  if (suffix === null) return ''
  const percent = model.value.changePercent
  if (percent === null) {
    const delta = model.value.changeKcal ?? 0
    const sign = delta > 0 ? '+' : ''
    return `${sign}${formatKcal(delta)} kcal ${suffix}`
  }
  const sign = percent > 0 ? '+' : ''
  return `${sign}${formatNumber(percent)}% ${suffix}`
})

const selectable = computed(() => props.view === 'day')
const optionsOpen = ref(false)
const CHART_OPTIONS: { value: TrendChartType; label: string }[] = [
  { value: 'bars', label: 'Barre' },
  { value: 'line', label: 'Linea' },
]
const linePoints = computed(() =>
  model.value.bars
    .map((bar) => `${PLOT.left + (bar.x + bar.width / 2) * plotWidth},${PLOT.top + (1 - bar.height) * plotHeight}`)
    .join(' '),
)

function setChart(chart: TrendChartType): void {
  trendOptions.chart = chart
}

function select(bar: TrendBar): void {
  if (!selectable.value) return
  emit('select', bar.date)
}

function choose(view: TrendView): void {
  emit('update:view', view)
}
</script>

<template>
  <section data-testid="trend-section" class="rounded-2xl border border-border bg-card p-4">
      <div class="mb-3 flex items-center gap-2">
        <div
          data-testid="trend-views"
          role="group"
          aria-label="Vista dell'andamento"
          class="flex flex-1 rounded-lg bg-muted p-1"
        >
        <button
          v-for="option in VIEW_OPTIONS"
          :key="option.value"
          type="button"
          :data-testid="`trend-view-${option.value}`"
          :aria-pressed="view === option.value"
          class="flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-xs font-medium transition-colors"
          :class="
            view === option.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="choose(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <button
          type="button"
          data-testid="trend-options-toggle"
          class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Opzioni del grafico"
          :aria-expanded="optionsOpen"
          aria-controls="trend-options"
          @click="optionsOpen = !optionsOpen"
        >
          <SlidersHorizontal class="size-4" />
        </button>
      </div>

      <div
        v-if="optionsOpen"
        id="trend-options"
        data-testid="trend-options"
        class="mb-3 space-y-2 rounded-xl border border-border p-3"
      >
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs text-muted-foreground">Grafico</span>
          <div role="group" aria-label="Tipo di grafico" class="inline-flex rounded-lg bg-muted p-1">
            <button
              v-for="option in CHART_OPTIONS"
              :key="option.value"
              type="button"
              :data-testid="`trend-chart-${option.value}`"
              :aria-pressed="trendOptions.chart === option.value"
              class="cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors"
              :class="
                trendOptions.chart === option.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="setChart(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="trend-toggle-target"
            :aria-pressed="trendOptions.showTarget"
            class="cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors"
            :class="
              trendOptions.showTarget
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground'
            "
            @click="trendOptions.showTarget = !trendOptions.showTarget"
          >
            Linea target
          </button>
          <button
            type="button"
            data-testid="trend-toggle-values"
            :aria-pressed="trendOptions.showValues"
            class="cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors"
            :class="
              trendOptions.showValues
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground'
            "
            @click="trendOptions.showValues = !trendOptions.showValues"
          >
            Valori
          </button>
        </div>
      </div>

      <div v-if="model.bars.length > 0" class="space-y-3">
        <dl class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-xl bg-muted/60 py-2">
            <dd data-testid="trend-average" class="text-sm font-semibold tabular-nums">
              {{ model.averageKcal === null ? '—' : formatKcal(model.averageKcal) }}
            </dd>
            <dt class="text-[11px] text-muted-foreground">Media kcal</dt>
          </div>
          <div class="rounded-xl bg-muted/60 py-2">
            <dd data-testid="trend-recorded" class="text-sm font-semibold tabular-nums">
              {{ model.recordedDays }} su {{ model.totalDays }}
            </dd>
            <dt class="text-[11px] text-muted-foreground">Giorni con pasti</dt>
          </div>
          <div v-if="changeLabel" class="rounded-xl bg-muted/60 py-2">
            <dd data-testid="trend-change" class="text-sm font-semibold tabular-nums">
              {{ changeLabel }}
            </dd>
            <dt class="text-[11px] text-muted-foreground">Variazione</dt>
          </div>
        </dl>

        <svg
          :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
          class="h-auto w-full"
          role="group"
          :aria-label="model.chartLabel"
        >
          <title>{{ model.chartLabel }}</title>

          <text
            :x="PLOT.left - 4"
            :y="PLOT.top + 4"
            text-anchor="end"
            class="fill-muted-foreground text-[9px] tabular-nums"
          >
            {{ formatKcal(model.yMax) }}
          </text>
          <text
            :x="PLOT.left - 4"
            :y="PLOT.top + plotHeight"
            text-anchor="end"
            class="fill-muted-foreground text-[9px] tabular-nums"
          >
            0
          </text>
          <line
            :x1="PLOT.left"
            :y1="PLOT.top + plotHeight"
            :x2="WIDTH - PLOT.right"
            :y2="PLOT.top + plotHeight"
            class="stroke-border"
            stroke-width="1"
          />

          <g v-if="targetY !== null && trendOptions.showTarget">
            <line
              data-testid="trend-target-line"
              :x1="PLOT.left"
              :y1="targetY"
              :x2="WIDTH - PLOT.right"
              :y2="targetY"
              class="stroke-muted-foreground"
              stroke-width="1"
              stroke-dasharray="4 3"
            />
            <text
              data-testid="trend-target-label"
              :x="WIDTH - PLOT.right"
              :y="targetY - 3"
              text-anchor="end"
              class="fill-muted-foreground text-[9px]"
            >
              Target attuale {{ formatKcal(model.targetKcal!) }} kcal
            </text>
          </g>

          <polyline
            v-if="trendOptions.chart === 'line' && model.bars.length > 1"
            data-testid="trend-line"
            :points="linePoints"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-primary"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          <g
            v-for="bar in model.bars"
            :key="bar.key"
            data-testid="trend-bar"
            :role="selectable ? 'button' : 'img'"
            :tabindex="selectable ? 0 : undefined"
            class="text-primary focus:outline-none"
            :class="selectable ? 'cursor-pointer' : ''"
            :aria-label="bar.label"
            @click="select(bar)"
            @keydown.enter.prevent="select(bar)"
            @keydown.space.prevent="select(bar)"
          >
            <title>{{ bar.label }}</title>
            <rect
              v-if="trendOptions.chart === 'bars'"
              :x="barX(bar)"
              :y="barY(bar)"
              :width="barWidth(bar)"
              :height="barHeight(bar)"
              rx="2"
              fill="currentColor"
              class="opacity-80"
              :class="selectable ? 'hover:opacity-100' : ''"
            />
            <circle
              v-else
              :cx="barX(bar) + barWidth(bar) / 2"
              :cy="barY(bar)"
              r="3"
              fill="currentColor"
            />
            <text
              v-if="trendOptions.showValues"
              data-testid="trend-value"
              :x="barX(bar) + barWidth(bar) / 2"
              :y="barY(bar) - 4"
              text-anchor="middle"
              class="fill-muted-foreground text-[8px] tabular-nums"
            >
              {{ formatKcal(bar.kcal) }}
            </text>
          </g>

          <text
            v-for="index in model.labelIndices"
            :key="`label-${index}`"
            :x="slotX(index)"
            :y="HEIGHT - 8"
            text-anchor="middle"
            class="fill-muted-foreground text-[9px] tabular-nums"
          >
            {{ model.slotLabels[index] }}
          </text>
        </svg>
      </div>

    <p v-else data-testid="trend-empty" class="text-sm text-muted-foreground">
      {{ model.emptyLabel }}
    </p>
  </section>
</template>
