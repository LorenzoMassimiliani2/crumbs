<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, ref } from 'vue'

import { formatKcal, formatNumber } from '@/lib/diary'
import {
  buildDayTrend,
  formatTrendDate,
  formatTrendDay,
  type Stats,
  type TrendBar,
} from '@/lib/stats'

const props = defineProps<{ stats: Stats; today: string }>()
const emit = defineEmits<{ select: [date: string] }>()

const open = ref(true)
const model = computed(() => buildDayTrend(props.stats, props.today))

const WIDTH = 320
const HEIGHT = 180
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

function barLabel(bar: TrendBar): string {
  const meals = bar.meals === 1 ? '1 pasto' : `${bar.meals} pasti`
  return `${formatTrendDate(bar.date)}: ${formatKcal(bar.kcal)} kcal, ${meals}`
}

const changeLabel = computed(() => {
  const change = model.value.changePercent
  if (change === null) return ''
  const sign = change > 0 ? '+' : ''
  return `${sign}${formatNumber(change)}% rispetto ai 14 giorni precedenti`
})

const chartLabel = computed(() => {
  const count = model.value.bars.length
  return `Andamento delle kcal degli ultimi 14 giorni, ${count} ${count === 1 ? 'giorno' : 'giorni'} con pasti`
})

function select(bar: TrendBar): void {
  emit('select', bar.date)
}
</script>

<template>
  <section data-testid="trend-section" class="rounded-2xl border border-border bg-card">
    <button
      type="button"
      data-testid="trend-toggle"
      class="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
      :aria-expanded="open"
      aria-controls="trend-body"
      @click="open = !open"
    >
      <span class="text-sm font-medium">Andamento</span>
      <ChevronDown
        class="size-4 text-muted-foreground transition-transform"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </button>

    <div v-if="open" id="trend-body" class="px-4 pb-4">
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
          :aria-label="chartLabel"
        >
          <title>{{ chartLabel }}</title>

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

          <g v-if="targetY !== null">
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

          <g
            v-for="bar in model.bars"
            :key="bar.date"
            data-testid="trend-bar"
            role="button"
            tabindex="0"
            class="cursor-pointer text-primary focus:outline-none"
            :aria-label="barLabel(bar)"
            @click="select(bar)"
            @keydown.enter.prevent="select(bar)"
            @keydown.space.prevent="select(bar)"
          >
            <title>{{ barLabel(bar) }}</title>
            <rect
              :x="barX(bar)"
              :y="barY(bar)"
              :width="barWidth(bar)"
              :height="barHeight(bar)"
              rx="2"
              fill="currentColor"
              class="opacity-80 hover:opacity-100"
            />
          </g>

          <text
            v-for="index in model.labelIndices"
            :key="`label-${index}`"
            :x="slotX(index)"
            :y="HEIGHT - 8"
            text-anchor="middle"
            class="fill-muted-foreground text-[9px] tabular-nums"
          >
            {{ formatTrendDay(model.days[index]!) }}
          </text>
        </svg>
      </div>

      <p v-else data-testid="trend-empty" class="text-sm text-muted-foreground">
        Nessun giorno con pasti negli ultimi 14 giorni.
      </p>
    </div>
  </section>
</template>
