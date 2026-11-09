import { nextTick, onBeforeUnmount, onMounted, type Ref } from 'vue'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps a full-screen dialog usable: locks page scroll, closes on Escape and
 * keeps Tab inside the dialog while it is mounted.
 */
export function useModal(container: Ref<HTMLElement | null>, onClose: () => void): void {
  let previousOverflow = ''

  function focusables(): HTMLElement[] {
    const root = container.value
    if (!root) return []
    return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => !element.hasAttribute('disabled'),
    )
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const items = focusables()
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  onMounted(() => {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeydown)
    void nextTick(() => {
      focusables()[0]?.focus()
    })
  })

  onBeforeUnmount(() => {
    document.body.style.overflow = previousOverflow
    document.removeEventListener('keydown', onKeydown)
  })
}
