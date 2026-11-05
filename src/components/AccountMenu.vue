<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { setTheme, theme } from '@/composables/useTheme'

const props = defineProps<{
  name?: string | null
  email?: string | null
}>()

const emit = defineEmits<{ signOut: [] }>()

const themeOptions = [
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
] as const

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
      class="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
    >
      <div class="border-b border-border p-2">
        <p id="account-menu-theme-label" class="px-1 pb-1.5 text-xs font-medium text-muted-foreground">
          Tema
        </p>
        <div
          role="radiogroup"
          aria-labelledby="account-menu-theme-label"
          class="flex gap-1 rounded-lg bg-muted p-1"
        >
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="theme === option.value"
            class="flex-1 rounded-md px-2 py-1 text-xs transition-colors"
            :class="
              theme === option.value
                ? 'bg-background font-medium text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="setTheme(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

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
