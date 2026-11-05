import { ref } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'crumbs.theme'

/** Deve corrispondere a --background in src/style.css. */
const THEME_COLORS: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#0a0a0a',
}

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const theme = ref<Theme>(readStoredTheme())

export function applyTheme(next: Theme = theme.value): void {
  document.documentElement.classList.toggle('dark', next === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[next])
}

export function initTheme(): void {
  theme.value = readStoredTheme()
  applyTheme()
}

export function setTheme(next: Theme): void {
  theme.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // localStorage può non essere disponibile: il tema resta valido per la sessione
  }
  applyTheme()
}
