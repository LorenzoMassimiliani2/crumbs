<script setup lang="ts">
import { toasts } from '@/composables/useToast'
</script>

<template>
  <div
    data-testid="toast-host"
    class="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
    aria-live="polite"
    aria-atomic="false"
  >
    <p
      v-for="toast in toasts"
      :key="toast.id"
      data-testid="toast"
      role="status"
      class="pointer-events-auto w-full max-w-sm rounded-xl px-4 py-2 text-center text-sm shadow-lg"
      :class="
        toast.kind === 'error'
          ? 'bg-destructive text-white'
          : 'bg-foreground text-background'
      "
    >
      {{ toast.message }}
    </p>
  </div>
</template>
