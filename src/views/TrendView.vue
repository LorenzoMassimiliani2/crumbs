<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import CalorieTrend from '@/components/CalorieTrend.vue'
import { pendingTrendDate, trendView } from '@/composables/trendState'
import { apiFetch } from '@/lib/api'
import { toLocalDateString } from '@/lib/diary'
import { trendRangeFor, type Stats } from '@/lib/stats'

const router = useRouter()
const stats = ref<Stats | null>(null)
const failed = ref(false)
const today = computed(() => toLocalDateString(new Date()))

async function load(): Promise<void> {
  failed.value = false
  const { from, to } = trendRangeFor(trendView.value, today.value)
  try {
    const response = await apiFetch(`/api/stats?from=${from}&to=${to}`)
    if (!response.ok) {
      failed.value = true
      return
    }
    stats.value = (await response.json()) as Stats
  } catch {
    failed.value = true
  }
}

function selectDay(date: string): void {
  pendingTrendDate.value = date
  void router.push('/')
}

watch(trendView, () => {
  void load()
})

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <RouterLink
        to="/"
        data-testid="trend-back"
        aria-label="Torna al Diario"
        class="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft class="size-5" />
      </RouterLink>
      <h1 class="text-base font-semibold">Andamento</h1>
    </div>

    <p v-if="failed && !stats" role="alert" class="text-sm text-destructive">
      Impossibile caricare l'andamento.
    </p>

    <CalorieTrend
      v-if="stats"
      :stats="stats"
      :today="today"
      :view="trendView"
      @update:view="trendView = $event"
      @select="selectDay"
    />
  </div>
</template>
