<script setup lang="ts">
import { KeyRound, LoaderCircle, LogIn } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import {
  authenticated,
  authMessage,
  clearCredential,
  credential,
  decodeJwtExpiry,
  googleClientId,
  identity,
  loadGoogleIdentity,
  saveCredential,
} from '@/lib/auth'

const ready = ref(false)
const token = ref('')
const error = ref('')
const checking = ref(false)
const googleLoading = ref(false)

let gisInitialized = false

async function refreshIdentity(): Promise<boolean> {
  const response = await apiFetch('/api/me')
  if (!response.ok) return false

  const data = (await response.json()) as {
    credential: string
    email?: string
    name?: string
    picture?: string
  }
  identity.value =
    data.credential === 'google'
      ? { email: data.email, name: data.name, picture: data.picture }
      : null
  return true
}

async function initialCheck(): Promise<void> {
  const saved = credential.value
  if (!saved) {
    ready.value = true
    return
  }

  checking.value = true
  try {
    if (await refreshIdentity()) {
      authenticated.value = true
    } else {
      clearCredential()
    }
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
    checking.value = false
    ready.value = true
  }
}

async function initGoogle(): Promise<void> {
  if (gisInitialized) return

  const id = await loadGoogleIdentity()
  id.initialize({
    client_id: googleClientId,
    auto_select: false,
    cancel_on_tap_outside: true,
    callback: (response) => {
      void completeGoogleLogin(response.credential)
    },
  })
  gisInitialized = true
}

async function completeGoogleLogin(value: string | undefined): Promise<void> {
  googleLoading.value = false
  if (!value) {
    error.value = 'Accesso con Google non riuscito.'
    return
  }

  const expiresAt = decodeJwtExpiry(value)
  if (expiresAt === null) {
    error.value = 'Accesso con Google non riuscito.'
    return
  }

  error.value = ''
  try {
    saveCredential({ token: value, kind: 'google', expiresAt })
    if (await refreshIdentity()) {
      authenticated.value = true
    } else {
      clearCredential()
      error.value = 'Account Google non autorizzato.'
    }
  } catch {
    clearCredential()
    error.value = 'Impossibile contattare il server.'
  }
}

async function loginWithGoogle(): Promise<void> {
  error.value = ''
  googleLoading.value = true

  try {
    await initGoogle()
    const id = window.google?.accounts?.id
    if (!id) throw new Error('google identity unavailable')

    id.prompt((notification) => {
      if (authenticated.value || notification.getSkippedReason() === 'credential_returned') {
        googleLoading.value = false
        return
      }

      if (notification.isDismissedMoment()) {
        googleLoading.value = false
        error.value = 'Accesso annullato.'
      } else if (notification.isNotDisplayed()) {
        googleLoading.value = false
        error.value = "Login Google non disponibile. Usa l'accesso con token."
      } else if (notification.isSkippedMoment()) {
        googleLoading.value = false
        error.value = "Nessun account Google disponibile. Usa l'accesso con token."
      }
    })
  } catch {
    googleLoading.value = false
    error.value = 'Impossibile avviare il login Google.'
  }
}

async function submitToken(): Promise<void> {
  const value = token.value.trim()
  if (!value) return

  error.value = ''
  checking.value = true
  try {
    const response = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${value}` },
    })
    if (response.ok) {
      saveCredential({ token: value, kind: 'service', expiresAt: null })
      identity.value = null
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

let revalidating = false

async function revalidate(): Promise<void> {
  if (!authenticated.value || revalidating) return

  revalidating = true
  try {
    await refreshIdentity()
  } catch {
    // Una rivalidazione fallita per rete non chiude la sessione.
  } finally {
    revalidating = false
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') void revalidate()
}

onMounted(async () => {
  window.addEventListener('focus', revalidate)
  document.addEventListener('visibilitychange', onVisibilityChange)

  await initialCheck()
  if (!authenticated.value && googleClientId) void initGoogle().catch(() => undefined)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', revalidate)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div v-if="!ready" class="flex min-h-svh items-center justify-center">
    <LoaderCircle class="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
  </div>

  <div v-else-if="!authenticated" class="flex min-h-svh items-center justify-center px-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Accesso</CardTitle>
        <CardDescription>
          Accedi con Google oppure usa il token di accesso.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <template v-if="googleClientId">
          <Button
            type="button"
            class="w-full"
            :disabled="googleLoading || checking"
            @click="loginWithGoogle"
          >
            <LoaderCircle v-if="googleLoading" class="animate-spin" aria-hidden="true" />
            <LogIn v-else aria-hidden="true" />
            Accedi con Google
          </Button>
        </template>

        <p v-if="authMessage || error" class="text-sm text-destructive">
          {{ error || authMessage }}
        </p>

        <div v-if="googleClientId" class="relative">
          <div class="absolute inset-0 flex items-center">
            <span class="w-full border-t border-border" />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-card px-2 text-muted-foreground">oppure</span>
          </div>
        </div>

        <form class="space-y-4" @submit.prevent="submitToken">
          <div class="space-y-2">
            <Label for="api-token">Token di accesso</Label>
            <Input
              id="api-token"
              v-model="token"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
            />
          </div>


          <Button
            type="submit"
            :variant="googleClientId ? 'outline' : 'default'"
            class="w-full"
            :disabled="checking || !token.trim()"
          >
            <LoaderCircle v-if="checking" class="animate-spin" aria-hidden="true" />
            <KeyRound v-else aria-hidden="true" />
            Entra con token
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>

  <slot v-else />
</template>
