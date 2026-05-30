import { Moon, Sun } from 'lucide-react'
import { useCallback, useSyncExternalStore } from 'react'
import { m } from '#/paraglide/messages'

function getServerSnapshot(): 'light' | 'dark' {
  return 'light'
}

function getSnapshot(): 'light' | 'dark' {
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function subscribe(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => callback()
  media.addEventListener('change', onChange)
  window.addEventListener('storage', onChange)
  return () => {
    media.removeEventListener('change', onChange)
    window.removeEventListener('storage', onChange)
  }
}

function applyTheme(mode: 'light' | 'dark') {
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(mode)
  document.documentElement.setAttribute('data-theme', mode)
}

export default function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback(() => {
    const next = mode === 'light' ? 'dark' : 'light'
    window.localStorage.setItem('theme', next)
    applyTheme(next)
    // Notify same-tab subscribers
    window.dispatchEvent(new StorageEvent('storage'))
  }, [mode])

  const isDark = mode === 'dark'

  return (
    <button
      type='button'
      onClick={toggle}
      aria-label={isDark ? m.theme_label_dark() : m.theme_label_light()}
      aria-pressed={isDark}
      title={isDark ? m.theme_label_dark() : m.theme_label_light()}
      className='inline-flex items-center rounded-lg p-1.5 text-text-secondary transition-colors duration-fast ease-out hover:bg-bg-inset hover:text-text-primary flex-shrink-0'
    >
      {isDark ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}
