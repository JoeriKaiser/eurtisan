/**
 * Flag rows in docs/VERIFIED.md whose code has changed since it was verified.
 *
 * A "this area is fine" claim rots silently: the code moves on and the claim
 * stays, steering people away from something that may now be broken. Rather
 * than trusting discipline to keep the ledger current, this makes drift
 * mechanically detectable — each row records the paths it covers and the commit
 * it was verified at, and we ask git whether anything under those paths has
 * changed since.
 *
 * A flagged row is not necessarily wrong. It means the evidence needs re-reading
 * before it can be relied on.
 *
 * Usage:
 *   bun run docs:check-verified
 *
 * Exit codes: 0 = no drift, 1 = drift found or the ledger could not be parsed.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const LEDGER = 'docs/VERIFIED.md'

interface Row {
  area: string
  paths: string[]
  sha: string
}

/** Pull `code`-quoted path globs out of the Paths cell. */
function parsePaths(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((p) => p.includes('/'))
}

function parseLedger(markdown: string): Row[] {
  const rows: Row[] = []

  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
    // Area | Paths | Evidence | Not checked | Verified at | Date
    if (cells.length < 6) continue
    if (cells[0] === 'Area' || cells[0].startsWith('---')) continue

    const sha = cells[4].replace(/`/g, '').trim()
    if (!/^[0-9a-f]{7,40}$/.test(sha)) continue

    rows.push({ area: cells[0], paths: parsePaths(cells[1]), sha })
  }

  return rows
}

function changedSince(sha: string, paths: string[]): string[] {
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${sha}..HEAD`, '--', ...paths], {
      encoding: 'utf8',
    })
    return out.split('\n').filter(Boolean)
  } catch {
    // Unknown commit (shallow clone, rewritten history) — treat as drift so the
    // row gets looked at rather than silently trusted.
    return [`<could not diff from ${sha}>`]
  }
}

function main(): void {
  const rows = parseLedger(readFileSync(LEDGER, 'utf8'))

  if (rows.length === 0) {
    console.error(`No parseable rows found in ${LEDGER}. Has the table format changed?`)
    process.exit(1)
  }

  let drifted = 0

  for (const row of rows) {
    if (row.paths.length === 0) {
      console.warn(`? ${row.area}: no paths recorded, cannot check for drift`)
      continue
    }

    const changes = changedSince(row.sha, row.paths)
    if (changes.length === 0) {
      console.log(`ok    ${row.area}`)
      continue
    }

    drifted++
    console.log(`STALE ${row.area}  (verified at ${row.sha}, ${changes.length} file(s) changed)`)
    for (const file of changes.slice(0, 5)) console.log(`        ${file}`)
    if (changes.length > 5) console.log(`        … and ${changes.length - 5} more`)
  }

  console.log(`\n${rows.length} row(s) checked, ${drifted} stale.`)

  if (drifted > 0) {
    console.log(
      `\nRe-read the evidence for the rows above. If a claim still holds, update its\n` +
        `"Verified at" commit; if it no longer holds, delete the row and open an audit finding.`,
    )
    process.exit(1)
  }
}

main()
