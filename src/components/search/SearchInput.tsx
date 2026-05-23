import { Command, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/cn'

const PLACEHOLDER_OPTIONS = ['vintage lamp', 'ceramic mug', 'handmade earrings']

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onClear: () => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export default function SearchInput({
  value,
  onChange,
  onSubmit,
  onClear,
  inputRef: externalRef,
}: SearchInputProps) {
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef ?? internalRef
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(false)

  // Rotating placeholder
  useEffect(() => {
    if (value.trim().length > 0) return
    const timer = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_OPTIONS.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [value])

  const placeholder =
    value.trim().length > 0 ? '' : `Search for "${PLACEHOLDER_OPTIONS[placeholderIndex]}"...`

  return (
    <div className='relative'>
      <Search
        className={cn(
          'absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors',
          isFocused ? 'text-accent-primary' : 'text-text-muted',
        )}
        aria-hidden='true'
      />
      <Input
        ref={inputRef}
        type='search'
        role='combobox'
        aria-expanded='true'
        aria-autocomplete='list'
        aria-controls='search-suggestions'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder={placeholder}
        className='h-11 pl-10 pr-20 text-base sm:text-sm'
        autoComplete='off'
        autoCorrect='off'
        autoCapitalize='off'
        spellCheck={false}
      />
      <div className='absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1'>
        {value.length > 0 ? (
          <button
            type='button'
            onClick={onClear}
            className='rounded-md p-1 text-text-muted transition-colors hover:bg-bg-inset hover:text-text-primary'
            aria-label='Clear search'
          >
            <X size={16} aria-hidden='true' />
          </button>
        ) : (
          <kbd className='hidden items-center gap-0.5 rounded border border-border-default bg-surface-inset px-1.5 py-0.5 text-[10px] font-medium text-text-muted sm:inline-flex'>
            <Command size={10} aria-hidden='true' />K
          </kbd>
        )}
      </div>
    </div>
  )
}
