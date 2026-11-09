import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearToasts, dismissToast, showToast, toasts } from './useToast'

afterEach(() => {
  clearToasts()
  vi.useRealTimers()
})

describe('useToast', () => {
  it('adds a toast and removes it after the duration', () => {
    vi.useFakeTimers()
    showToast('Salvato.', 'success', 1000)
    expect(toasts.value.map((toast) => toast.message)).toEqual(['Salvato.'])

    vi.advanceTimersByTime(1000)
    expect(toasts.value).toEqual([])
  })

  it('can be dismissed immediately', () => {
    const id = showToast('Errore', 'error')
    dismissToast(id)
    expect(toasts.value).toEqual([])
  })
})
