;(function () {
  var stored, prefersDark, mode, root
  try {
    stored = window.localStorage.getItem('theme')
    prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    mode = stored === 'light' || stored === 'dark' ? stored : prefersDark ? 'dark' : 'light'
    root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(mode)
    root.setAttribute('data-theme', mode)
  } catch (_e) {}
})()
