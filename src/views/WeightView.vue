<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import WeightChart from '@/components/WeightChart.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { toLocalDateString } from '@/lib/diary'
import {
  formatWeight,
  formatWeightChange,
  formatWeightDate,
  weightSummary,
  type WeightEntry,
} from '@/lib/weight'

const entries = ref<WeightEntry[]>([])
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const error = ref('')

const today = toLocalDateString(new Date())
const form = reactive({
  date: today,
  weight: '' as string | number,
})

const summary = computed(() => weightSummary(entries.value))
const latest = computed(() => entries.value.slice(-10).reverse())

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch(`/api/weights?today=${today}`)
    if (!response.ok) {
      error.value = 'Impossibile caricare le misure.'
      return
    }
    entries.value = (await response.json()) as WeightEntry[]
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  const weight = Number(form.weight)
  if (form.weight === '' || !Number.isFinite(weight)) {
    error.value = 'Inserisci un peso valido.'
    return
  }

  saving.value = true
  message.value = ''
  error.value = ''
  try {
    const response = await apiFetch(`/api/weights/${form.date}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight }),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      error.value = body?.error ?? 'Salvataggio non riuscito.'
      return
    }

    form.weight = ''
    message.value = 'Salvato.'
    await load()
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-2xl border border-border bg-card p-4">
      <div class="flex items-end justify-between gap-3">
        <div>
          <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Peso corrente</p>
          <p data-testid="current-weight" class="text-3xl font-semibold tabular-nums">
            {{ summary.current === null ? '—' : formatWeight(summary.current.weight) }}
            <span
              v-if="summary.current !== null"
              class="text-sm font-normal text-muted-foreground"
            >kg</span>
          </p>
        </div>
        <div class="text-right">
          <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Ultima misura</p>
          <p data-testid="last-date" class="text-sm font-medium">
            {{ summary.current === null ? '—' : formatWeightDate(summary.current.date) }}
          </p>
        </div>
      </div>

      <p data-testid="weight-change" class="mt-2 text-sm">
        <template v-if="summary.change === null">Variazione: —</template>
        <template v-else>
          Variazione: <span class="font-medium">{{ formatWeightChange(summary.change) }}</span>
        </template>
      </p>
    </section>

    <p v-if="!loading && entries.length === 0" class="text-sm text-muted-foreground">
      Nessuna misura registrata. Inserisci la prima misura per iniziare.
    </p>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

    <WeightChart v-if="entries.length > 0" :entries="entries" :today="today" />

    <Card>
      <CardHeader>
        <CardTitle>Registra il peso</CardTitle>
        <CardDescription>Una misura per data: salvare la stessa data aggiorna il valore.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-3" @submit.prevent="save">
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label for="weight-date">Data</Label>
              <Input id="weight-date" v-model="form.date" type="date" />
            </div>
            <div class="space-y-1.5">
              <Label for="weight-value">Peso (kg)</Label>
              <Input
                id="weight-value"
                v-model="form.weight"
                type="number"
                inputmode="decimal"
                min="30"
                max="300"
                step="0.1"
              />
            </div>
          </div>

          <div class="flex items-center gap-3">
            <Button type="submit" :disabled="saving">
              {{ saving ? 'Salvataggio…' : 'Salva' }}
            </Button>
            <p v-if="message" role="status" class="text-sm text-muted-foreground">{{ message }}</p>
          </div>
        </form>
      </CardContent>
    </Card>

    <Card v-if="entries.length > 0">
      <CardHeader>
        <CardTitle>Ultime misure</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="divide-y divide-border">
          <li
            v-for="entry in latest"
            :key="entry.date"
            data-testid="weight-entry"
            class="flex items-center justify-between py-2 text-sm"
          >
            <span>{{ formatWeightDate(entry.date) }}</span>
            <span class="font-medium tabular-nums">{{ formatWeight(entry.weight) }} kg</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
