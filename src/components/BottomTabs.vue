<script setup lang="ts">
import { House, UserRound } from '@lucide/vue'
import { RouterLink } from 'vue-router'

const tabs = [
  { to: '/', label: 'Oggi', icon: House },
  { to: '/profile', label: 'Profilo', icon: UserRound },
] as const
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75"
    aria-label="Navigazione principale"
  >
    <div class="mx-auto flex w-full max-w-2xl pb-[env(safe-area-inset-bottom)]">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        active-class="font-medium text-foreground"
      >
        <component :is="tab.icon" class="size-5" aria-hidden="true" />
        {{ tab.label }}
      </RouterLink>
    </div>
  </nav>
</template>
