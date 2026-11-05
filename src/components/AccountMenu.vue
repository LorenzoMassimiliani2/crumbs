<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  name?: string | null
  email?: string | null
}>()

const emit = defineEmits<{ signOut: [] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const initial = computed(() => {
  const source = props.name?.trim() || props.email?.trim() || ''
  return source ? source[0]!.toUpperCase() : '?'
})

const accountLabel = computed(() => props.name?.trim() || props.email?.trim() || 'utente')

function close() {
  open.value = false
}

function toggle() {
  open.value = !open.value
}

function onSignOut() {
  close()
  emit('signOut')
}

function onPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
      :aria-label="`Account di ${accountLabel}`"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ initial }}
    </button>

    <div
      v-if="open"
      role="menu"
      class="absolute right-0 top-11 z-30 w-36 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
    >
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center px-3 py-2.5 text-left text-sm hover:bg-muted"
        @click="onSignOut"
      >
        Esci
      </button>
    </div>
  </div>
</template>
