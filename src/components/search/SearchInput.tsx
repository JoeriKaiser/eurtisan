import { Command, Search, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Input } from '#/components/ui/input'
import { m } from '#/paraglide/messages'
import { cn } from '#/lib/cn'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onClear: () => void
  inputRef?: React.RefObject<HTMLInputElement | null>
  autoFocus?: boolean
  /** Id of the suggestion listbox this input controls. */
  listboxId?: string
  /** Id of the currently highlighted option, for aria-activedescendant. */
  activeOptionId?: string
  /** Whether the suggestion listbox is currently showing options. */
  isExpanded?: boolean
}

export default function SearchInput({
  value,
  onChange,
  onSubmit,
  onClear,
  inputRef: externalRef,
  autoFocus = false,
  listboxId,
  activeOptionId,
  isExpanded = false,
}: SearchInputProps) {
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef ?? internalRef
  const [isFocused, setIsFocused] = useState(false)

  const placeholder = value.trim().length > 0 ? '' : m.search_input_placeholder()

  return (
    <div className='relative'>
      <Search
        className={cn(
          'absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors',
          isFocused ? 'text-accent-primary' : 'text-text-placeholder',
        )}
        aria-hidden='true'
      />
      <Input
        ref={inputRef}
        type='search'
        role='combobox'
        aria-expanded={isExpanded}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete='list'
        aria-label={m.search_input_placeholder()}
        autoFocus={autoFocus}
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
            aria-label={m.search_clear_input()}
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
