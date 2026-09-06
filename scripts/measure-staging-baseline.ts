// scripts/measure-staging-baseline.ts
const routes = [
  { name: 'Homepage (/)', path: '/' },
  { name: 'Search (/search)', path: '/search' },
  { name: 'Categories (/category/all)', path: '/category/all' },
  { name: 'Shop Front (/shops/silver-and-stone)', path: '/shops/silver-and-stone' },
  { name: 'Shop Paged (/shops/silver-and-stone?page=1)', path: '/shops/silver-and-stone?page=1' },
  {
    name: 'Product (/shops/silver-and-stone/products/alpine-cascade-earrings)',
    path: '/shops/silver-and-stone/products/alpine-cascade-earrings',
  },
  { name: 'API Health (/api/health/ready)', path: '/api/health/ready' },
]

console.log('=== Staging Network & Response Baseline ===\n')

for (const r of routes) {
  const url = `https://staging.eurtisan.eu${r.path}`
  const start = performance.now()
  const res = await fetch(url, {
    headers: {
      'Accept-Encoding': 'gzip, br, zstd',
      'User-Agent': 'Eurtisan-Perf-Audit/1.0',
    },
    redirect: 'manual',
  })
  const ttfb = performance.now() - start
  const body = await res.arrayBuffer()
  const total = performance.now() - start

  const encoding = res.headers.get('content-encoding') ?? 'NONE (uncompressed)'
  const cacheControl = res.headers.get('cache-control') ?? 'NONE'
  const location = res.headers.get('location') ?? '-'

  console.log(`${r.name}:`)
  console.log(`  Status: ${res.status} ${res.statusText}`)
  console.log(`  TTFB: ${ttfb.toFixed(1)}ms | Total: ${total.toFixed(1)}ms`)
  console.log(`  Size: ${body.byteLength} bytes`)
  console.log(`  Content-Encoding: ${encoding}`)
  console.log(`  Cache-Control: ${cacheControl}`)
  if (location !== '-') console.log(`  Location (Redirect): ${location}`)
  console.log('')
}

export {}
