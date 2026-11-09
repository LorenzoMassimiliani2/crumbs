<script setup lang="ts">
import { RouterView } from 'vue-router'

import AccountMenu from '@/components/AccountMenu.vue'
import BottomTabs from '@/components/BottomTabs.vue'
import TokenGate from '@/components/TokenGate.vue'
import ToastHost from '@/components/ToastHost.vue'
import { identity, signOut } from '@/lib/auth'
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
          <div class="ml-auto flex items-center gap-2">
            <AccountMenu
              :name="identity?.name"
              :email="identity?.email"
              @sign-out="signOut()"
            />
          </div>
        </div>
      </header>

      <main class="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-24">
        <RouterView />
      </main>

      <BottomTabs />
      <ToastHost />
    </div>
  </TokenGate>
</template>
