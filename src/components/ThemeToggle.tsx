import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { m } from '#/paraglide/messages'

function getInitialMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light'
  }
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode: 'light' | 'dark') {
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(mode)
  document.documentElement.setAttribute('data-theme', mode)
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const initial = getInitialMode()
    setMode(initial)
    applyTheme(initial)
  }, [])

  function toggle() {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    applyTheme(next)
    window.localStorage.setItem('theme', next)
  }

  const isDark = mode === 'dark'

  return (
    <button
      type='button'
      onClick={toggle}
      aria-label={isDark ? m.theme_label_dark() : m.theme_label_light()}
      aria-pressed={isDark}
      title={isDark ? m.theme_label_dark() : m.theme_label_light()}
      className='inline-flex items-center rounded-lg p-1.5 text-text-secondary transition-colors duration-fast ease-out hover:bg-bg-inset hover:text-text-primary'
    >
      {isDark ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}
