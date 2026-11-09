<script setup lang="ts">
import { Plus, Search, X } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { activityDurationMinutes, formatDuration, type Activity } from '@/lib/activity'
import { apiFetch } from '@/lib/api'

const props = defineProps<{ date: string }>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const MAX_NOTE = 500
const MAX_NAME = 80

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function timeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const now = new Date()
const startTime = ref(timeValue(now))
const endTime = ref(timeValue(new Date(now.getTime() + 60 * 60 * 1000)))

const catalog = ref<Activity[]>([])
const loadingCatalog = ref(false)
const catalogError = ref('')
const query = ref('')
const selectedId = ref<string | null>(null)
const newName = ref('')
const creating = ref(false)
const saving = ref(false)
const error = ref('')
const note = ref('')

const dateLabel = computed(() => {
  const [year, month, day] = props.date.split('-').map(Number) as [number, number, number]
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, day))
})

const filtered = computed(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) return catalog.value
  return catalog.value.filter((activity) => activity.name.toLowerCase().includes(term))
})

const selected = computed(
  () => catalog.value.find((activity) => activity.id === selectedId.value) ?? null,
)

/** Local wall time on the selected day, turned into an ISO instant. */
function instantFor(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  const [year, month, day] = props.date.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}

const startedAt = computed(() => instantFor(startTime.value))
const endedAt = computed(() => instantFor(endTime.value))

const durationMinutes = computed<number | null>(() => {
  if (!startedAt.value || !endedAt.value) return null
  return activityDurationMinutes(startedAt.value, endedAt.value)
})

const timeError = computed(() => {
  if (!startedAt.value || !endedAt.value) return 'Inserisci un orario valido.'
  if (Date.parse(endedAt.value) <= Date.parse(startedAt.value)) {
    return "L'ora di fine deve essere successiva all'ora di inizio."
  }
  return ''
})

async function loadCatalog(): Promise<void> {
  loadingCatalog.value = true
  catalogError.value = ''
  try {
    const response = await apiFetch('/api/activities')
    if (!response.ok) {
      catalogError.value = 'Impossibile caricare le attività.'
      return
    }
    catalog.value = (await response.json()) as Activity[]
  } catch {
    catalogError.value = 'Impossibile contattare il server.'
  } finally {
    loadingCatalog.value = false
  }
}

async function createActivity(): Promise<void> {
  const name = newName.value.trim()
  if (!name) {
    error.value = "Il nome dell'attività è obbligatorio."
    return
  }
  if (name.length > MAX_NAME) {
    error.value = `Il nome può avere al massimo ${MAX_NAME} caratteri.`
    return
  }
  if (creating.value) return

  creating.value = true
  error.value = ''
  try {
    const response = await apiFetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      error.value = body?.error ?? 'Creazione non riuscita. Riprova.'
      return
    }
    const activity = (await response.json()) as Activity
    newName.value = ''
    query.value = ''
    await loadCatalog()
    selectedId.value = activity.id
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    creating.value = false
  }
}

async function save(): Promise<void> {
  if (saving.value) return
  if (!selectedId.value) {
    error.value = "Scegli un'attività."
    return
  }
  if (timeError.value) {
    error.value = timeError.value
    return
  }

  saving.value = true
  error.value = ''
  try {
    const response = await apiFetch('/api/activity-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId: selectedId.value,
        localDate: props.date,
        startedAt: startedAt.value,
        endedAt: endedAt.value,
        note: note.value.trim() || null,
      }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      error.value = body?.error ?? 'Salvataggio non riuscito. Riprova.'
      return
    }
    emit('saved')
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    saving.value = false
  }
}

onMounted(loadCatalog)
</script>

<template>
  <div
    data-testid="add-activity-flow"
    class="fixed inset-0 z-40 flex justify-center bg-foreground/40"
    role="dialog"
    aria-modal="true"
    aria-label="Aggiungi attività"
  >
    <div class="flex h-full w-full max-w-2xl flex-col bg-background">
      <header class="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" type="button" aria-label="Chiudi" @click="emit('close')">
          <X />
        </Button>
        <h2 class="text-base font-semibold">Aggiungi attività</h2>
      </header>

      <div class="flex-1 space-y-5 overflow-y-auto px-4 pb-40 pt-4">
        <section class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Attività
          </p>

          <div class="relative">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              v-model="query"
              type="search"
              aria-label="Cerca attività"
              placeholder="Cerca un'attività"
              class="pl-9"
            />
          </div>

          <p v-if="loadingCatalog" class="text-xs text-muted-foreground">Caricamento…</p>
          <p v-else-if="catalogError" role="alert" class="text-xs text-destructive">
            {{ catalogError }}
          </p>

          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="activity in filtered"
              :key="activity.id"
              type="button"
              data-testid="activity-option"
              :aria-pressed="selectedId === activity.id"
              class="rounded-full border px-3 py-1.5 text-sm transition-colors"
              :class="
                selectedId === activity.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground'
              "
              @click="selectedId = activity.id"
            >
              {{ activity.name }}
            </button>
          </div>

          <p
            v-if="!loadingCatalog && !catalogError && filtered.length === 0"
            class="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground"
          >
            Nessuna attività trovata.
          </p>
        </section>

        <section class="space-y-2 rounded-xl border border-border bg-card p-3">
          <p class="text-sm font-semibold">Nuova attività</p>
          <div class="space-y-1.5">
            <Label for="activity-new-name">Nome</Label>
            <Input
              id="activity-new-name"
              v-model="newName"
              :maxlength="MAX_NAME"
              placeholder="Es. Arrampicata"
              aria-label="Nome nuova attività"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            data-testid="create-activity"
            :disabled="creating"
            @click="createActivity"
          >
            <Plus />
            Crea attività
          </Button>
          <p class="text-[11px] text-muted-foreground">
            L'attività creata resta nel catalogo anche se non salvi la voce.
          </p>
        </section>

        <section class="space-y-3">
          <div class="space-y-1.5">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data</p>
            <p data-testid="activity-date" class="text-sm capitalize">{{ dateLabel }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label for="activity-start">Inizio</Label>
              <Input
                id="activity-start"
                v-model="startTime"
                type="time"
                aria-label="Ora di inizio"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="activity-end">Fine</Label>
              <Input id="activity-end" v-model="endTime" type="time" aria-label="Ora di fine" />
            </div>
          </div>

          <p class="text-sm text-muted-foreground">
            Durata
            <span data-testid="activity-duration" class="font-medium text-foreground tabular-nums">
              {{ durationMinutes === null ? '—' : formatDuration(durationMinutes) }}
            </span>
          </p>

          <div class="space-y-1.5">
            <Label for="activity-note">Nota</Label>
            <Input
              id="activity-note"
              v-model="note"
              :maxlength="MAX_NOTE"
              placeholder="Nota (opzionale)"
              aria-label="Nota attività"
            />
          </div>

          <p v-if="selected" class="text-sm text-muted-foreground">
            Selezionata: <span class="font-medium text-foreground">{{ selected.name }}</span>
          </p>
        </section>

        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <p v-else-if="timeError" role="alert" class="text-sm text-destructive">{{ timeError }}</p>
      </div>

      <footer class="border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          class="w-full"
          size="lg"
          data-testid="save-activity"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Salvataggio…' : 'Salva attività' }}
        </Button>
      </footer>
    </div>
  </div>
</template>
