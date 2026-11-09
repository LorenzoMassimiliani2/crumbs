<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { showToast } from '@/composables/useToast'
import { apiFetch } from '@/lib/api'
import { currentMonthRange, downloadExport, type DiaryExport } from '@/lib/export'
import { ageAt, bmi, mifflinStJeorBmr } from '@/lib/health'

interface ProfileResponse {
  weight: number | null
  height: number | null
  sex: 'm' | 'f' | null
  birthDate: string | null
  targetKcal: number | null
}

const form = reactive({
  height: '' as string | number,
  sex: '' as '' | 'm' | 'f',
  birthDate: '',
  targetKcal: '' as string | number,
})

// The current weight comes from the Peso section and is read-only here.
const currentWeight = ref<number | null>(null)

const loading = ref(true)
const saving = ref(false)
const error = ref('')

const initialRange = currentMonthRange()
const exportFrom = ref(initialRange.from)
const exportTo = ref(initialRange.to)
const exporting = ref(false)

function numberOrNull(value: string | number): number | null {
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const bmr = computed(() => {
  const weight = currentWeight.value
  const height = numberOrNull(form.height)
  const age = ageAt(form.birthDate)

  if (weight === null || height === null || form.sex === '' || age === null) return null
  return mifflinStJeorBmr({ weightKg: weight, heightCm: height, sex: form.sex, ageYears: age })
})

const bmiValue = computed(() => {
  const weight = currentWeight.value
  const height = numberOrNull(form.height)
  return weight !== null && height !== null ? bmi(weight, height) : null
})

function applyProfile(profile: ProfileResponse): void {
  currentWeight.value = profile.weight ?? null
  form.height = profile.height?.toString() ?? ''
  form.sex = profile.sex ?? ''
  form.birthDate = profile.birthDate ?? ''
  form.targetKcal = profile.targetKcal?.toString() ?? ''
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch('/api/profile')
    if (!response.ok) {
      error.value = 'Impossibile caricare il profilo.'
      return
    }
    applyProfile((await response.json()) as ProfileResponse)
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    const response = await apiFetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        height: numberOrNull(form.height),
        sex: form.sex,
        birthDate: form.birthDate,
        targetKcal: numberOrNull(form.targetKcal),
      }),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      showToast(body?.error ?? 'Salvataggio non riuscito.', 'error')
      return
    }

    applyProfile((await response.json()) as ProfileResponse)
    showToast('Profilo salvato.')
  } catch {
    showToast('Impossibile contattare il server.', 'error')
  } finally {
    saving.value = false
  }
}

async function exportDiary(): Promise<void> {
  exporting.value = true
  try {
    const query = new URLSearchParams({ from: exportFrom.value, to: exportTo.value })
    const response = await apiFetch(`/api/export?${query}`)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      showToast(body?.error ?? 'Esportazione non riuscita.', 'error')
      return
    }
    await downloadExport((await response.json()) as DiaryExport)
    showToast('Export pronto.')
  } catch {
    showToast('Impossibile contattare il server.', 'error')
  } finally {
    exporting.value = false
  }
}

onMounted(load)
</script>

<template>
  <p v-if="loading" class="text-sm text-muted-foreground">Caricamento…</p>
  <p v-else-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>

  <form v-else class="space-y-4" @submit.prevent="save">
    <Card>
      <CardHeader>
        <CardTitle>Dati fisici</CardTitle>
        <CardDescription>Altezza, sesso e data di nascita alimentano BMR e BMI.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-1.5">
          <Label for="height">Altezza (cm)</Label>
          <Input
            id="height"
            v-model="form.height"
            type="number"
            inputmode="decimal"
            min="100"
            max="250"
            step="0.1"
          />
        </div>

        <div class="space-y-1.5">
          <Label for="sex">Sesso</Label>
          <select
            id="sex"
            v-model="form.sex"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          >
            <option value="" disabled>Scegli</option>
            <option value="m">Uomo</option>
            <option value="f">Donna</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <Label for="birthDate">Data di nascita</Label>
          <Input
            id="birthDate"
            v-model="form.birthDate"
            type="date"
          />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Obiettivo e BMR/BMI</CardTitle>
        <CardDescription>Il target kcal lo scegli tu; BMR e BMI sono solo informativi.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-1.5">
          <Label for="targetKcal">Target kcal</Label>
          <Input
            id="targetKcal"
            v-model="form.targetKcal"
            type="number"
            inputmode="numeric"
            min="800"
            max="6000"
            step="1"
          />
        </div>

        <dl class="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm">
          <div>
            <dt class="text-muted-foreground">BMR (Mifflin-St Jeor)</dt>
            <dd class="font-medium">{{ bmr === null ? '—' : `${bmr} kcal` }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground">BMI</dt>
            <dd class="font-medium">{{ bmiValue === null ? '—' : bmiValue.toFixed(1).replace('.', ',') }}</dd>
          </div>
        </dl>
        <p class="text-xs text-muted-foreground">
          Il BMR è il consumo a riposo stimato; il BMI è un rapporto peso/altezza informativo.
          Nessuno dei due modifica il target.
        </p>

        <div>
          <Button type="submit" :disabled="saving">
            {{ saving ? 'Salvataggio…' : 'Salva' }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </form>

  <Card class="mt-4">
    <CardHeader>
      <CardTitle>Esporta i dati</CardTitle>
      <CardDescription>
        Scarica le voci dei pasti e i totali giornalieri di un intervallo in un file Excel.
      </CardDescription>
    </CardHeader>

    <CardContent>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <Label for="export-from">Dal</Label>
          <Input id="export-from" v-model="exportFrom" type="date" />
        </div>
        <div class="space-y-1.5">
          <Label for="export-to">Al</Label>
          <Input id="export-to" v-model="exportTo" type="date" />
        </div>
      </div>

      <div class="mt-3 flex items-center gap-3">
        <Button
          type="button"
          data-testid="export"
          :disabled="exporting"
          @click="exportDiary"
        >
          {{ exporting ? 'Preparazione…' : 'Esporta Excel' }}
        </Button>
      </div>
    </CardContent>
  </Card>

  <p class="mt-4 text-xs text-muted-foreground">
    Dati da
    <a
      href="https://world.openfoodfacts.org"
      target="_blank"
      rel="noreferrer"
      class="underline"
    >Open Food Facts (ODbL)</a>
  </p>
  <p class="mt-1 text-xs text-muted-foreground">
    Fonte alimenti semplici:
    <a
      href="https://fdc.nal.usda.gov"
      target="_blank"
      rel="noreferrer"
      class="underline"
    >USDA FoodData Central (CC0)</a>
  </p>
</template>
