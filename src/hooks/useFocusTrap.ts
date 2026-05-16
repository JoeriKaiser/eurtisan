import { useEffect, useRef } from 'react'

const TABBABLE_SELECTOR = [
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Focus the first tabbable element, or the container itself
    const tabbable = Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR))
    const first = tabbable[0] ?? container
    first.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return

      const elements = Array.from(
        container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null)

      if (elements.length === 0) return

      const firstElement = elements[0]
      const lastElement = elements[elements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [active])

  return containerRef
}
