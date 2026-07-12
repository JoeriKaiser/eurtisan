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

  it('prefixes formula-triggering characters with a single quote', () => {
    const csv = generateCSV(
      [
        { payload: '=SUM(A1:A10)' },
        { payload: '+cmd' },
        { payload: '-rm -rf' },
        { payload: '@SUM(A1)' },
        { payload: 'safe value' },
      ],
      [{ key: 'payload', label: 'Payload' }],
    )
    expect(csv).toBe("Payload\n'=SUM(A1:A10)\n'+cmd\n'-rm -rf\n'@SUM(A1)\nsafe value")
  })

  it('escapes formula-triggering values that also contain commas or quotes', () => {
    const csv = generateCSV(
      [{ payload: '=A1,B1' }, { payload: '="cmd"' }],
      [{ key: 'payload', label: 'Payload' }],
    )
    expect(csv).toBe('Payload\n"\'=A1,B1"\n"\'=""cmd"""')
  })
})
