<script setup lang="ts">
import { House, Scale, UserRound } from '@lucide/vue'
import { RouterLink } from 'vue-router'

const tabs = [
  { to: '/weight', label: 'Peso', icon: Scale },
  { to: '/', label: 'Diario', icon: House },
  { to: '/profile', label: 'Profilo', icon: UserRound },
] as const
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75"
    aria-label="Navigazione principale"
  >
    <div class="mx-auto flex w-full max-w-2xl gap-1 px-1 pb-[env(safe-area-inset-bottom)] pt-1">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        active-class="bg-primary/10 font-semibold text-primary"
      >
        <component :is="tab.icon" class="size-5" aria-hidden="true" />
        {{ tab.label }}
      </RouterLink>
    </div>
  </nav>
</template>
