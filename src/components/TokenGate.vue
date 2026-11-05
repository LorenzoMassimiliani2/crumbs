<script setup lang="ts">
import { KeyRound, LoaderCircle } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { clearToken, getToken, setToken } from '@/lib/api'

const ready = ref(false)
const authenticated = ref(false)
const token = ref('')
const error = ref('')
const checking = ref(false)

async function verify(value: string): Promise<boolean> {
  const response = await fetch('/api/meals', {
    headers: { Authorization: `Bearer ${value}` },
  })
  return response.ok
}

async function initialCheck(): Promise<void> {
  const saved = getToken()
  if (!saved) {
    ready.value = true
    return
  }

  checking.value = true
  try {
    authenticated.value = await verify(saved)
  } catch {
    authenticated.value = false
  } finally {
    if (!authenticated.value) clearToken()
    checking.value = false
    ready.value = true
  }
}

async function submit(): Promise<void> {
  const value = token.value.trim()
  if (!value) return

  error.value = ''
  checking.value = true
  try {
    if (await verify(value)) {
      setToken(value)
      token.value = ''
      authenticated.value = true
    } else {
      error.value = 'Token non valido.'
    }
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    checking.value = false
  }
}

function onUnauthorized(): void {
  authenticated.value = false
  error.value = 'Token revocato o sessione terminata.'
}

onMounted(() => {
  window.addEventListener('crumbs:unauthorized', onUnauthorized)
  void initialCheck()
})

onBeforeUnmount(() => window.removeEventListener('crumbs:unauthorized', onUnauthorized))
</script>

<template>
  <div v-if="!ready" class="flex min-h-svh items-center justify-center">
    <LoaderCircle class="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
  </div>

  <div v-else-if="!authenticated" class="flex min-h-svh items-center justify-center px-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Accesso</CardTitle>
        <CardDescription>Inserisci il token di accesso per aprire il diario.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <div class="space-y-2">
            <Label for="api-token">Token</Label>
            <Input
              id="api-token"
              v-model="token"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
            />
          </div>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

          <Button type="submit" class="w-full" :disabled="checking || !token.trim()">
            <LoaderCircle v-if="checking" class="animate-spin" aria-hidden="true" />
            <KeyRound v-else aria-hidden="true" />
            Entra
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>

  <slot v-else />
</template>
