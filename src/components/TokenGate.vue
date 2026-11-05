<script setup lang="ts">
import { KeyRound, LoaderCircle } from '@lucide/vue'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
const googleButton = ref<HTMLElement | null>(null)

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

function renderGoogleButton(): void {
  const container = googleButton.value
  const id = window.google?.accounts?.id
  if (!container || !id) return

  container.replaceChildren()
  id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width: Math.min(container.clientWidth || 320, 400),
    locale: 'it',
  })
}

async function initGoogle(): Promise<void> {
  error.value = ''
  googleLoading.value = true

  try {
    if (!gisInitialized) {
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

    await nextTick()
    renderGoogleButton()
  } catch {
    error.value = "Login Google non disponibile. Usa l'accesso con token."
  } finally {
    googleLoading.value = false
  }
}

async function completeGoogleLogin(value: string | undefined): Promise<void> {
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

watch(authenticated, async (value) => {
  if (value || !ready.value || !gisInitialized) return
  await nextTick()
  renderGoogleButton()
})

onMounted(async () => {
  window.addEventListener('focus', revalidate)
  document.addEventListener('visibilitychange', onVisibilityChange)

  await initialCheck()
  if (!authenticated.value && googleClientId) void initGoogle()
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
        <div v-if="googleClientId" class="flex min-h-10 items-center justify-center">
          <div ref="googleButton" class="flex justify-center" />
          <LoaderCircle
            v-if="googleLoading"
            class="size-5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        </div>

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
