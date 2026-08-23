import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const dir = process.argv[2] ?? 'dist/client/assets'
const files = readdirSync(dir).filter((f) => f.endsWith('.js')).sort()
const byName = new Map<string, { raw: number; gz: number; code: string }>()
for (const f of files) {
  const p = join(dir, f)
  const contents = readFileSync(p)
  byName.set(f, { raw: statSync(p).size, gz: gzipSync(contents, { level: 9 }).length, code: contents.toString('utf8') })
}
const entry = files.find((f) => byName.get(f)!.code.includes('__vite__mapDeps'))!
console.log(`ENTRY ${entry}`)
const initial = new Set<string>()
const visit = (fileName: string) => {
  if (initial.has(fileName)) return
  if (!byName.has(fileName)) return
  initial.add(fileName)
  for (const m of byName.get(fileName)!.code.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) {
    if (m[1]) visit(m[1])
  }
}
visit(entry)
const rows = [...initial].map((f) => ({ file: f, raw: byName.get(f)!.raw, gz: byName.get(f)!.gz })).sort((a, b) => b.gz - a.gz)
for (const r of rows) console.log(`${r.gz}\t${r.raw}\t${r.file}`)
console.log(`TOTAL_INITIAL ${rows.length} files gz=${rows.reduce((t, r) => t + r.gz, 0)} raw=${rows.reduce((t, r) => t + r.raw, 0)}`)
