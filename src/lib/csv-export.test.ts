import { describe, expect, it } from 'vitest'
import { generateCSV } from './csv-export'

describe('generateCSV', () => {
  it('generates header and rows', () => {
    const csv = generateCSV(
      [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ],
      [
        { key: 'name', label: 'Name' },
        { key: 'age', label: 'Age' },
      ],
    )
    expect(csv).toBe('Name,Age\nAlice,30\nBob,25')
  })

  it('escapes values with commas', () => {
    const csv = generateCSV([{ name: 'Doe, John' }], [{ key: 'name', label: 'Name' }])
    expect(csv).toBe('Name\n"Doe, John"')
  })

  it('escapes values with quotes', () => {
    const csv = generateCSV([{ name: 'Say "hello"' }], [{ key: 'name', label: 'Name' }])
    expect(csv).toBe('Name\n"Say ""hello"""')
  })

  it('handles null and undefined values', () => {
    const csv = generateCSV(
      [
        { name: 'Alice', age: null },
        { name: 'Bob', age: undefined },
      ],
      [
        { key: 'name', label: 'Name' },
        { key: 'age', label: 'Age' },
      ],
    )
    expect(csv).toBe('Name,Age\nAlice,\nBob,')
  })
})
