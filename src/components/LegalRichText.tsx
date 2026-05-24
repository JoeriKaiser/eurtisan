import type { ReactNode } from 'react'

interface LegalRichTextProps {
  text: string
}

/**
 * Renders legal text with paragraph and list support.
 *
 * Parsing rules:
 * - Lines starting with "- " become unordered list items.
 * - Blank lines separate blocks (paragraphs or lists).
 * - Consecutive non-list lines are joined into a single paragraph.
 */
export function LegalRichText({ text }: LegalRichTextProps) {
  const lines = text.split('\n')
  const elements: ReactNode[] = []
  let currentList: string[] = []
  let currentPara: string[] = []

  const flushPara = () => {
    if (currentPara.length > 0) {
      elements.push(
        <p key={elements.length} className='mb-4 leading-7 text-text-secondary'>
          {currentPara.join(' ')}
        </p>,
      )
      currentPara = []
    }
  }

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={elements.length} className='my-4 list-disc space-y-2 pl-6 text-text-secondary'>
          {currentList.map((item) => (
            <li key={item} className='leading-7'>
              {item}
            </li>
          ))}
        </ul>,
      )
      currentList = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      flushPara()
      currentList.push(trimmed.slice(2))
    } else if (trimmed === '') {
      flushPara()
      flushList()
    } else {
      flushList()
      currentPara.push(trimmed)
    }
  }

  flushPara()
  flushList()

  return <>{elements}</>
}
