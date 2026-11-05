<script setup lang="ts">
// PROTOTIPO — tre varianti della stessa app, switchabili con ?variant=A|B|C.
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import VariantA from './VariantA.vue'
import VariantB from './VariantB.vue'
import VariantC from './VariantC.vue'

const variants = [
  { key: 'A', name: 'Diario classico', component: VariantA },
  { key: 'B', name: 'Timeline', component: VariantB },
  { key: 'C', name: 'Dashboard', component: VariantC },
]

function readVariant(): string {
  const requested = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
  return variants.some((variant) => variant.key === requested) ? (requested as string) : 'A'
}

const current = ref(readVariant())
const active = computed(() => variants.find((variant) => variant.key === current.value) ?? variants[0])

function setVariant(key: string) {
  current.value = key
  const url = new URL(window.location.href)
  url.searchParams.set('variant', key)
  window.history.replaceState({}, '', url)
}

function cycle(step: number) {
  const index = variants.findIndex((variant) => variant.key === current.value)
  const next = (index + step + variants.length) % variants.length
  setVariant(variants[next].key)
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (event.key === 'ArrowLeft') cycle(-1)
  if (event.key === 'ArrowRight') cycle(1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="min-h-svh bg-neutral-200 text-foreground">
    <div class="relative mx-auto min-h-svh w-full max-w-[430px] overflow-x-hidden bg-background shadow-2xl">
      <component :is="active.component" :key="active.key" />
    </div>

    <div
      class="pointer-events-none fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-black/75 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white"
    >
      Prototipo · dati finti
    </div>

    <div
      class="fixed bottom-[76px] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900 px-1.5 py-1.5 text-white shadow-xl ring-1 ring-white/10"
    >
      <button
        type="button"
        class="rounded-full p-1.5 transition hover:bg-white/15"
        aria-label="Variante precedente"
        @click="cycle(-1)"
      >
        <ChevronLeft class="size-4" />
      </button>
      <span class="min-w-44 text-center text-xs font-medium tabular-nums">
        {{ active.key }} · {{ active.name }}
      </span>
      <button
        type="button"
        class="rounded-full p-1.5 transition hover:bg-white/15"
        aria-label="Variante successiva"
        @click="cycle(1)"
      >
        <ChevronRight class="size-4" />
      </button>
    </div>
  </div>
</template>
