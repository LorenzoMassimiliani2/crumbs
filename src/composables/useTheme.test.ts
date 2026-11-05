import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { initTheme, setTheme, theme } from './useTheme'

describe('tema', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    initTheme()
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    initTheme()
  })

  it('parte dal tema chiaro quando non c\u00e8 una preferenza salvata', () => {
    expect(theme.value).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('attiva il tema scuro e lo salva', () => {
    setTheme('dark')

    expect(theme.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('crumbs.theme')).toBe('dark')
  })

  it('ripristina la preferenza salvata all\'avvio', () => {
    localStorage.setItem('crumbs.theme', 'dark')

    initTheme()

    expect(theme.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('torna al tema chiaro', () => {
    setTheme('dark')
    setTheme('light')

    expect(theme.value).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('crumbs.theme')).toBe('light')
  })

  it('aggiorna il theme-color del browser con il tema attivo', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)

    setTheme('dark')
    expect(meta.getAttribute('content')).toBe('#0a0a0a')

    setTheme('light')
    expect(meta.getAttribute('content')).toBe('#ffffff')
  })
})
