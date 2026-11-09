import { ref } from 'vue'

export type ToastKind = 'success' | 'error'

export interface Toast {
  id: number
  message: string
  kind: ToastKind
}

export const toasts = ref<Toast[]>([])
let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()

export function dismissToast(id: number): void {
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)
  timers.delete(id)
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

export function showToast(message: string, kind: ToastKind = 'success', durationMs = 3500): number {
  const id = nextId++
  toasts.value = [...toasts.value, { id, message, kind }]
  timers.set(
    id,
    setTimeout(() => dismissToast(id), durationMs),
  )
  return id
}

export function clearToasts(): void {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  toasts.value = []
}
