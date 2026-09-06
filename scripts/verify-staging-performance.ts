const targetUrl = process.env.PERF_TARGET_URL || 'https://staging.eurtisan.eu'

interface CheckResult {
  name: string
  passed: boolean
  detail: string
}

const results: CheckResult[] = []

function isPrivateNoStore(cacheControl: string): boolean {
  const value = cacheControl.toLowerCase()
  return value.includes('private') && value.includes('no-store')
}

async function runProbes() {
  console.log(`=== Performance Verification Probes for ${targetUrl} ===\n`)

  let anonRes: Response
  let anonDuration: number
  let anonBody: string
  try {
    const anonStart = performance.now()
    anonRes = await fetch(`${targetUrl}/`, {
      headers: {
        'Accept-Encoding': 'gzip, br, zstd',
        'User-Agent': 'Eurtisan-Perf-Verifier/1.0',
      },
      redirect: 'manual',
    })
    anonDuration = performance.now() - anonStart
    anonBody = await anonRes.text()
  } catch (err: unknown) {
    const error = err as Error
    console.error(`[verify-staging-performance] Unable to reach ${targetUrl} (${error.message}).`)
    process.exit(1)
  }

  if (anonRes.status === 403) {
    console.error(
      `[verify-staging-performance] ${targetUrl} returned 403 Forbidden (Traefik IP whitelist).`,
    )
    console.error('Run from a whitelisted IP or set PERF_TARGET_URL to a reachable origin.')
    process.exit(1)
  }

  results.push({
    name: 'Anonymous Homepage Status',
    passed: anonRes.status === 200,
    detail: `Status ${anonRes.status} (TTFB: ${anonDuration.toFixed(1)}ms, HTML: ${(anonBody.length / 1024).toFixed(1)} KB)`,
  })

  const anonCacheControl = anonRes.headers.get('cache-control') || ''
  results.push({
    name: 'Anonymous HTML Cache-Control private, no-store',
    passed: isPrivateNoStore(anonCacheControl),
    detail: `Cache-Control: ${anonCacheControl || 'NONE'}`,
  })

  const anonVary = anonRes.headers.get('vary') || ''
  const hasVary =
    anonVary.toLowerCase().includes('cookie') && anonVary.toLowerCase().includes('accept-encoding')
  results.push({
    name: 'HTML Vary: Cookie, Accept-Encoding',
    passed: hasVary,
    detail: `Vary: ${anonVary || 'NONE'}`,
  })

  const headMatch = anonBody.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const headContent = headMatch ? headMatch[1] : anonBody
  const hasBlurPreload = /<link[^>]*rel=["']preload["'][^>]*width=40(?:&|["'])/i.test(headContent)
  results.push({
    name: 'Absence of 40px Blur Thumbnail Preload in <head>',
    passed: !hasBlurPreload,
    detail: hasBlurPreload
      ? 'FAIL: Low-res thumbnail preload detected'
      : 'PASS: Zero blur preloads hoisted',
  })

  const authRes = await fetch(`${targetUrl}/`, {
    headers: {
      'Accept-Encoding': 'gzip, br',
      Cookie: 'better-auth.session_token=probe_verification_token',
      'User-Agent': 'Eurtisan-Perf-Verifier/1.0',
    },
    redirect: 'manual',
  })
  const authCacheControl = authRes.headers.get('cache-control') || ''
  results.push({
    name: 'Authenticated HTML Cache-Control private, no-store',
    passed: isPrivateNoStore(authCacheControl),
    detail: `Cache-Control: ${authCacheControl || 'NONE'}`,
  })

  const favRes = await fetch(`${targetUrl}/favicon.ico`, {
    headers: { 'User-Agent': 'Eurtisan-Perf-Verifier/1.0' },
    redirect: 'manual',
  })
  results.push({
    name: 'Static /favicon.ico Elimination of 404 Fallthrough',
    passed: favRes.status === 200 || favRes.status === 304,
    detail: `Status ${favRes.status} (Content-Type: ${favRes.headers.get('content-type') || 'unknown'})`,
  })

  const shopRes = await fetch(`${targetUrl}/shops/silver-and-stone`, {
    headers: {
      'Accept-Encoding': 'gzip, br',
      'User-Agent': 'Eurtisan-Perf-Verifier/1.0',
    },
    redirect: 'manual',
  })
  results.push({
    name: 'Storefront Route Direct 200 OK (Zero 307 Redirects)',
    passed: shopRes.status === 200,
    detail: `Status ${shopRes.status} (Location: ${shopRes.headers.get('location') || 'none'})`,
  })

  console.log('Results:')
  let failures = 0
  for (const r of results) {
    const tag = r.passed ? 'PASS' : 'FAIL'
    console.log(`  ${tag}  ${r.name}: ${r.detail}`)
    if (!r.passed) failures++
  }

  console.log(
    `\n${failures === 0 ? 'All performance assertions PASSED.' : `${failures} assertion(s) failed.`}`,
  )
  if (failures > 0) {
    process.exit(1)
  }
}

void runProbes()

export {}
