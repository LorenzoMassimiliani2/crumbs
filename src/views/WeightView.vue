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

const editing = ref<WeightEntry | null>(null)
const editForm = reactive({ date: '', weight: '' as string | number })
const pendingEdit = ref<{ date: string; weight: number } | null>(null)
const confirmingOverwrite = ref(false)
const confirmingDelete = ref<string | null>(null)

function startEdit(entry: WeightEntry): void {
  editing.value = entry
  editForm.date = entry.date
  editForm.weight = String(entry.weight)
  pendingEdit.value = null
  confirmingOverwrite.value = false
  confirmingDelete.value = null
  message.value = ''
  error.value = ''
}

function cancelEdit(): void {
  editing.value = null
  pendingEdit.value = null
  confirmingOverwrite.value = false
}

function requestEditSave(): void {
  if (!editing.value) return
  const weight = Number(editForm.weight)
  if (editForm.weight === '' || !Number.isFinite(weight)) {
    error.value = 'Inserisci un peso valido.'
    return
  }
  if (editForm.date === '') {
    error.value = 'Inserisci una data.'
    return
  }

  const target = { date: editForm.date, weight }
  const occupied =
    target.date !== editing.value.date &&
    entries.value.some((entry) => entry.date === target.date)
  if (occupied) {
    pendingEdit.value = target
    confirmingOverwrite.value = true
    return
  }

  void commitEdit(target)
}

function confirmOverwrite(): void {
  if (pendingEdit.value) void commitEdit(pendingEdit.value)
}

function cancelOverwrite(): void {
  pendingEdit.value = null
  confirmingOverwrite.value = false
}

/**
 * Saving an edit writes the target date and, when the date changed, deletes the
 * original one. The new date goes first so a failed delete leaves a recoverable
 * duplicate instead of losing the measurement.
 */
async function commitEdit(target: { date: string; weight: number }): Promise<void> {
  const original = editing.value
  if (!original) return

  saving.value = true
  message.value = ''
  error.value = ''
  try {
    const response = await apiFetch(`/api/weights/${target.date}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight: target.weight }),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      error.value = body?.error ?? 'Salvataggio non riuscito.'
      return
    }

    if (target.date !== original.date) {
      const removal = await apiFetch(`/api/weights/${original.date}`, { method: 'DELETE' })
      if (!removal.ok && removal.status !== 404) {
        error.value = 'Modifica non completata. Ricarica e riprova.'
        await load()
        return
      }
    }

    editing.value = null
    pendingEdit.value = null
    confirmingOverwrite.value = false
    message.value = 'Misura aggiornata.'
    await load()
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    saving.value = false
  }
}

async function removeEntry(date: string): Promise<void> {
  saving.value = true
  message.value = ''
  error.value = ''
  try {
    const response = await apiFetch(`/api/weights/${date}`, { method: 'DELETE' })
    if (!response.ok && response.status !== 404) {
      error.value = 'Eliminazione non riuscita.'
      return
    }

    if (editing.value?.date === date) cancelEdit()
    confirmingDelete.value = null
    message.value = 'Misura eliminata.'
    await load()
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    saving.value = false
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

    <Card v-if="editing" data-testid="edit-weight-panel">
      <CardHeader>
        <CardTitle>Modifica la misura</CardTitle>
        <CardDescription>Salvando aggiorni questa misura, non ne crei una nuova.</CardDescription>
      </CardHeader>
      <CardContent>
        <form data-testid="edit-weight-form" class="space-y-3" @submit.prevent="requestEditSave">
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label for="edit-weight-date">Data</Label>
              <Input
                id="edit-weight-date"
                v-model="editForm.date"
                data-testid="edit-weight-date"
                type="date"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="edit-weight-value">Peso (kg)</Label>
              <Input
                id="edit-weight-value"
                v-model="editForm.weight"
                data-testid="edit-weight-value"
                type="number"
                inputmode="decimal"
                min="30"
                max="300"
                step="0.1"
              />
            </div>
          </div>

          <div
            v-if="confirmingOverwrite"
            data-testid="confirm-overwrite-weight"
            class="space-y-2 rounded-xl border border-destructive/40 p-3"
          >
            <p class="text-sm">
              La data {{ pendingEdit ? formatWeightDate(pendingEdit.date) : '' }} ha già una
              misura. Vuoi sovrascriverla?
            </p>
            <div class="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                data-testid="confirm-overwrite-weight-button"
                :disabled="saving"
                @click="confirmOverwrite"
              >
                Sovrascrivi
              </Button>
              <Button
                type="button"
                variant="ghost"
                data-testid="cancel-overwrite-weight"
                @click="cancelOverwrite"
              >
                Annulla
              </Button>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <Button type="submit" :disabled="saving" data-testid="save-edit-weight">
              {{ saving ? 'Salvataggio…' : 'Salva modifica' }}
            </Button>
            <Button
              type="button"
              variant="ghost"
              data-testid="cancel-edit-weight"
              @click="cancelEdit"
            >
              Annulla
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

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
            class="py-2 text-sm"
          >
            <div class="flex items-center justify-between gap-2">
              <span>{{ formatWeightDate(entry.date) }}</span>
              <span class="flex items-center gap-1">
                <span class="font-medium tabular-nums">{{ formatWeight(entry.weight) }} kg</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="edit-weight"
                  @click="startEdit(entry)"
                >
                  Modifica
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="delete-weight"
                  :disabled="saving"
                  @click="confirmingDelete = entry.date"
                >
                  Elimina
                </Button>
              </span>
            </div>

            <div
              v-if="confirmingDelete === entry.date"
              data-testid="confirm-delete-weight"
              class="mt-2 space-y-2 rounded-xl border border-destructive/40 p-3"
            >
              <p>
                Vuoi davvero eliminare la misura del {{ formatWeightDate(entry.date) }}?
                L'operazione è definitiva.
              </p>
              <div class="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  data-testid="confirm-delete-weight-button"
                  :disabled="saving"
                  @click="removeEntry(entry.date)"
                >
                  Conferma eliminazione
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="cancel-delete-weight"
                  @click="confirmingDelete = null"
                >
                  Annulla
                </Button>
              </div>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
