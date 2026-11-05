<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
const error = ref('')
const googleLoading = ref(false)
const googleButton = ref<HTMLElement | null>(null)

let gisInitialized = false

async function refreshIdentity(): Promise<boolean> {
  const response = await apiFetch('/api/me')
  if (!response.ok) return false

  const data = (await response.json()) as {
    email?: string
    name?: string
    picture?: string
  }
  identity.value = { email: data.email, name: data.name, picture: data.picture }
  return true
}

async function initialCheck(): Promise<void> {
  if (!credential.value) {
    ready.value = true
    return
  }

  try {
    if (await refreshIdentity()) {
      authenticated.value = true
    } else {
      clearCredential()
    }
  } catch {
    error.value = 'Impossibile contattare il server.'
  } finally {
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
    error.value = 'Impossibile caricare il login Google.'
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
    saveCredential({ token: value, expiresAt })
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
        <CardDescription>Accedi per aprire il diario.</CardDescription>
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

        <p v-else class="text-sm text-muted-foreground">
          Login Google non configurato: imposta `VITE_GOOGLE_CLIENT_ID` nel build.
        </p>

        <p v-if="authMessage || error" class="text-sm text-destructive">
          {{ error || authMessage }}
        </p>
      </CardContent>
    </Card>
  </div>

  <slot v-else />
</template>
