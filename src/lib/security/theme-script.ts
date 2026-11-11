/**
 * Inline theme initialization script that runs in <head> before React hydration
 * to prevent theme flashing (FOUC).
 *
 * See docs/THEME_HYDRATION.md for design rules.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=window.localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme: dark)').matches,m=s==='light'||s==='dark'?s:d?'dark':'light',r=document.documentElement;r.classList.remove('light','dark');r.classList.add(m);r.setAttribute('data-theme',m);}catch(_e){}})();`

/**
 * SHA-256 base64 digest of THEME_INIT_SCRIPT for CSP script-src.
 * Pinned by a unit test in src/lib/security/csp.test.ts to guarantee accuracy.
 */
export const THEME_INIT_SCRIPT_HASH = "'sha256-z4DIUWCuspUU/wG0nAskgQVb5KmVPFC+xOa5EXu7Ub0='"
