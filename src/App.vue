<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'

import TokenGate from '@/components/TokenGate.vue'
import { credential, identity } from '@/lib/auth'

const accountLabel = computed(
  () => identity.value?.email ?? (credential.value?.kind === 'service' ? 'Accesso con token' : ''),
)
</script>

<template>
  <TokenGate>
    <div class="flex min-h-svh flex-col bg-background">
      <header
        class="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75"
      >
        <div class="mx-auto flex h-14 w-full max-w-2xl items-center gap-2 px-4">
          <span
            class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            C
          </span>
          <span class="text-base font-semibold tracking-tight">Crumbs</span>
          <span v-if="accountLabel" class="ml-auto truncate text-xs text-muted-foreground">
            {{ accountLabel }}
          </span>
        </div>
      </header>

      <main class="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <RouterView />
      </main>
    </div>
  </TokenGate>
</template>
