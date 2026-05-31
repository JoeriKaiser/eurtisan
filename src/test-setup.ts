import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, beforeAll } from 'vitest'
import * as matchers from 'vitest-axe/matchers'
import 'vitest-axe/extend-expect'

import { pool } from './db.ts'

expect.extend(matchers)

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Apply migrations required by unit tests (dev DB may lag behind schema). */
beforeAll(async () => {
  const migrationPath = join(__dirname, '../drizzle/0057_email_suppression.sql')
  const sql = readFileSync(migrationPath, 'utf8')
  await pool.query(sql)
})

// JSDOM doesn't implement showModal/close for HTMLDialogElement. Mock them to prevent tests from crashing.
if (typeof HTMLDialogElement === 'function') {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    const event = new Event('close', { bubbles: true })
    this.dispatchEvent(event)
  }
}
