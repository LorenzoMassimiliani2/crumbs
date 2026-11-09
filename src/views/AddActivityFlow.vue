<script setup lang="ts">
import { Pencil, Plus, Search, Trash2, X } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  activityDurationMinutes,
  activityInstants,
  formatDuration,
  LONG_ACTIVITY_MINUTES,
  type Activity,
  type DayActivity,
} from '@/lib/activity'
import { apiFetch } from '@/lib/api'

const props = defineProps<{
  date: string
  activity?: DayActivity | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
}>()

const MAX_NOTE = 500
const MAX_NAME = 80

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function timeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function timeOfInstant(instant: string): string {
  const date = new Date(instant)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const editing = computed(() => props.activity != null)

const now = new Date()
const startTime = ref(
  props.activity ? timeOfInstant(props.activity.startedAt) : timeValue(now),
)
const endTime = ref(
  props.activity
    ? timeOfInstant(props.activity.endedAt)
    : timeValue(new Date(now.getTime() + 60 * 60 * 1000)),
)

const catalog = ref<Activity[]>([])
const loadingCatalog = ref(false)
const catalogError = ref('')
const query = ref('')
const selectedId = ref<string | null>(props.activity?.activityId ?? null)
const newName = ref('')
const creating = ref(false)
const saving = ref(false)
const error = ref('')
const note = ref(props.activity?.note ?? '')

const renaming = ref<Activity | null>(null)
const renameName = ref('')
const deletingActivity = ref<Activity | null>(null)
const catalogSaving = ref(false)
const catalogFeedback = ref('')

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

/** ISO instants of the selected day; an end before the start falls on the next day. */
const instants = computed(() => activityInstants(props.date, startTime.value, endTime.value))
const startedAt = computed(() => instants.value?.startedAt ?? null)
const endedAt = computed(() => instants.value?.endedAt ?? null)

const timeError = computed(() => {
  if (!instants.value) return 'Inserisci un orario valido.'
  if (startTime.value === endTime.value) {
    return "L'ora di fine deve essere successiva all'ora di inizio."
  }
  return ''
})

const durationMinutes = computed<number | null>(() => {
  if (!instants.value || timeError.value) return null
  return activityDurationMinutes(instants.value.startedAt, instants.value.endedAt)
})

const confirming = ref(false)
const confirmingDelete = ref(false)

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

function openRename(activity: Activity): void {
  renaming.value = activity
  renameName.value = activity.name
  deletingActivity.value = null
  catalogFeedback.value = ''
  error.value = ''
}

function cancelRename(): void {
  renaming.value = null
}

async function saveRename(): Promise<void> {
  if (!renaming.value || catalogSaving.value) return

  const name = renameName.value.trim()
  if (!name) {
    error.value = "Il nome dell'attività è obbligatorio."
    return
  }
  if (name.length > MAX_NAME) {
    error.value = `Il nome può avere al massimo ${MAX_NAME} caratteri.`
    return
  }

  catalogSaving.value = true
  error.value = ''
  catalogFeedback.value = ''
  try {
    const response = await apiFetch(`/api/activities/${renaming.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      error.value = body?.error ?? 'Rinomina non riuscita. Riprova.'
      return
    }
    const updated = (await response.json()) as Activity
    const index = catalog.value.findIndex((activity) => activity.id === updated.id)
    if (index >= 0) catalog.value[index] = updated
    renaming.value = null
    catalogFeedback.value = "Attività rinominata. Le voci già registrate non cambiano."
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    catalogSaving.value = false
  }
}

function askDelete(activity: Activity): void {
  deletingActivity.value = activity
  renaming.value = null
  catalogFeedback.value = ''
  error.value = ''
}

function cancelDelete(): void {
  deletingActivity.value = null
}

async function confirmDelete(): Promise<void> {
  if (!deletingActivity.value || catalogSaving.value) return

  const target = deletingActivity.value
  catalogSaving.value = true
  error.value = ''
  catalogFeedback.value = ''
  try {
    const response = await apiFetch(`/api/activities/${target.id}`, { method: 'DELETE' })
    if (!response.ok) {
      error.value = 'Eliminazione non riuscita. Riprova.'
      return
    }
    catalog.value = catalog.value.filter((activity) => activity.id !== target.id)
    if (selectedId.value === target.id) selectedId.value = null
    deletingActivity.value = null
    catalogFeedback.value = 'Attività eliminata. Le voci già registrate non cambiano.'
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    catalogSaving.value = false
  }
}

function requestSave(): void {
  if (saving.value) return
  if (!selected.value) {
    error.value = "Scegli un'attività."
    return
  }
  if (timeError.value) {
    error.value = timeError.value
    return
  }
  if (durationMinutes.value !== null && durationMinutes.value > LONG_ACTIVITY_MINUTES) {
    confirming.value = true
    return
  }
  void save()
}

function cancelConfirmation(): void {
  confirming.value = false
}

async function save(): Promise<void> {
  confirming.value = false
  if (saving.value || !selected.value || !startedAt.value || !endedAt.value) return

  saving.value = true
  error.value = ''
  try {
    const response = await apiFetch(
      editing.value ? `/api/activity-entries/${props.activity!.id}` : '/api/activity-entries',
      {
        method: editing.value ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: selected.value.id,
          localDate: props.date,
          startedAt: startedAt.value,
          endedAt: endedAt.value,
          note: note.value.trim() || null,
        }),
      },
    )
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

async function remove(): Promise<void> {
  if (!props.activity || saving.value) return
  saving.value = true
  error.value = ''

  try {
    const response = await apiFetch(`/api/activity-entries/${props.activity.id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      error.value = 'Eliminazione non riuscita. Riprova.'
      return
    }
    emit('deleted')
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
    :aria-label="editing ? 'Modifica attività' : 'Aggiungi attività'"
  >
    <div class="flex h-full w-full max-w-2xl flex-col bg-background">
      <header class="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" type="button" aria-label="Chiudi" @click="emit('close')">
          <X />
        </Button>
        <h2 class="text-base font-semibold">
          {{ editing ? 'Modifica attività' : 'Aggiungi attività' }}
        </h2>
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

          <div v-else class="space-y-2">
            <div
              v-for="activity in filtered"
              :key="activity.id"
              class="flex items-center gap-1 rounded-xl border pr-1 transition-colors"
              :class="
                selectedId === activity.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card'
              "
            >
              <button
                type="button"
                data-testid="activity-option"
                :aria-pressed="selectedId === activity.id"
                class="min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-left text-sm"
                :class="
                  selectedId === activity.id
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                "
                @click="selectedId = activity.id"
              >
                {{ activity.name }}
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                :aria-label="`Rinomina ${activity.name}`"
                :disabled="catalogSaving"
                @click="openRename(activity)"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                :aria-label="`Elimina ${activity.name}`"
                :disabled="catalogSaving"
                @click="askDelete(activity)"
              >
                <Trash2 />
              </Button>
            </div>
          </div>

          <p
            v-if="!loadingCatalog && !catalogError && filtered.length === 0"
            class="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground"
          >
            Nessuna attività trovata.
          </p>

          <section
            v-if="renaming"
            data-testid="rename-activity"
            class="space-y-2 rounded-xl border border-border bg-card p-3"
          >
            <p class="text-sm font-semibold">Rinomina attività</p>
            <div class="space-y-1.5">
              <Label for="catalog-activity-name">Nome</Label>
              <Input
                id="catalog-activity-name"
                v-model="renameName"
                :maxlength="MAX_NAME"
                aria-label="Nuovo nome attività"
              />
            </div>
            <div class="flex gap-2">
              <Button
                type="button"
                data-testid="save-rename-activity"
                :disabled="catalogSaving"
                @click="saveRename"
              >
                Salva
              </Button>
              <Button
                type="button"
                variant="ghost"
                data-testid="cancel-rename-activity"
                @click="cancelRename"
              >
                Annulla
              </Button>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Le voci già registrate non cambiano.
            </p>
          </section>

          <section
            v-if="deletingActivity"
            data-testid="confirm-delete-catalog"
            class="space-y-2 rounded-xl border border-destructive/40 p-3"
          >
            <p class="text-sm">Eliminare "{{ deletingActivity.name }}" dal catalogo?</p>
            <p class="text-xs text-muted-foreground">
              Le voci già registrate non cambiano: restano nel diario con il nome salvato.
            </p>
            <div class="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                data-testid="confirm-delete-catalog-button"
                :disabled="catalogSaving"
                @click="confirmDelete"
              >
                Elimina
              </Button>
              <Button
                type="button"
                variant="ghost"
                data-testid="cancel-delete-catalog"
                @click="cancelDelete"
              >
                Annulla
              </Button>
            </div>
          </section>

          <p v-if="catalogFeedback" class="text-xs text-muted-foreground">
            {{ catalogFeedback }}
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

        <section v-if="editing" class="space-y-2">
          <Button
            v-if="!confirmingDelete"
            type="button"
            variant="destructive"
            class="w-full"
            data-testid="delete-activity"
            :disabled="saving"
            @click="confirmingDelete = true"
          >
            Elimina attività
          </Button>
          <div
            v-else
            data-testid="confirm-delete-activity"
            class="space-y-2 rounded-xl border border-destructive/40 p-3"
          >
            <p class="text-sm">Vuoi davvero eliminare questa attività?</p>
            <div class="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                data-testid="confirm-delete-activity-button"
                :disabled="saving"
                @click="remove"
              >
                Conferma eliminazione
              </Button>
              <Button
                type="button"
                variant="ghost"
                data-testid="cancel-delete-activity"
                @click="confirmingDelete = false"
              >
                Annulla
              </Button>
            </div>
          </div>
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
          @click="requestSave"
        >
          {{ saving ? 'Salvataggio…' : editing ? 'Salva modifiche' : 'Salva attività' }}
        </Button>
      </footer>

      <div
        v-if="confirming"
        data-testid="long-activity-confirm"
        class="absolute inset-0 z-10 flex items-center justify-center bg-foreground/40 p-4"
        role="alertdialog"
        aria-modal="true"
        aria-label="Conferma durata"
      >
        <div class="w-full max-w-sm rounded-2xl border border-border bg-background p-4 shadow-xl">
          <p class="text-sm font-semibold">Durata superiore a 12 ore</p>
          <p class="mt-1 text-sm text-muted-foreground">
            Questa attività dura
            <span
              data-testid="long-activity-duration"
              class="font-medium text-foreground tabular-nums"
            >
              {{ formatDuration(durationMinutes ?? 0) }}
            </span>
            . Vuoi salvarla?
          </p>
          <div class="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              data-testid="cancel-long-activity"
              @click="cancelConfirmation"
            >
              Annulla
            </Button>
            <Button
              type="button"
              data-testid="confirm-long-activity"
              :disabled="saving"
              @click="save"
            >
              Salva comunque
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
