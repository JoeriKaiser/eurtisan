import { readFileSync } from 'node:fs'

const mf = JSON.parse(readFileSync('dist/client/manifest.json', 'utf8'))
const eager = new Set<string>()
const entries = Object.keys(mf).filter((k) => mf[k].isEntry)
const visit = (src: string) => {
  if (eager.has(src)) return
  const info = mf[src]
  if (!info) return
  eager.add(src)
  for (const imp of info.imports ?? []) visit(imp)
}
entries.forEach(visit)
console.log('entry keys:', entries.join(','))
console.log('eager modules:', eager.size)
const interesting = [...eager].filter(
  (s) => s.includes('paraglide') || /imprint|Report|reviews|notification|StatementOfReasons|PickupPoint|ShopOrderDetail|Footer|Header/i.test(s),
)
for (const s of interesting.sort()) console.log('EAGER', s)
