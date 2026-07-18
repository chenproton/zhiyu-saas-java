'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  label: string
  value: string
}

interface MultiSelectProps {
  options: string[] | MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}

export function MultiSelect({ options, value, onChange, placeholder = '请选择' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const normalizedOptions = useMemo<MultiSelectOption[]>(() => {
    return options.map((option) =>
      typeof option === 'string' ? { label: option, value: option } : option
    )
  }, [options])

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return normalizedOptions
    return normalizedOptions.filter((option) => option.label.toLowerCase().includes(q))
  }, [normalizedOptions, search])

  const valueToOption = useMemo(() => {
    const map = new Map<string, MultiSelectOption>()
    normalizedOptions.forEach((option) => map.set(option.value, option))
    return map
  }, [normalizedOptions])

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter((v) => v !== optionValue))
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex min-h-[36px] w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm transition-colors',
          open && 'border-ring ring-ring/50 ring-1'
        )}
      >
        {value.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          value.map((optionValue) => {
            const option = valueToOption.get(optionValue)
            const displayLabel = option?.label ?? optionValue
            return (
              <span
                key={optionValue}
                className="inline-flex items-center gap-1 rounded-sm bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600"
              >
                {displayLabel}
                <span
                  onClick={(e) => removeOption(optionValue, e)}
                  className="cursor-pointer text-blue-400 hover:text-blue-800"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            )
          })
        )}
        <span className="ml-auto pl-2">
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          <div className="px-2 pb-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索..."
              className="w-full rounded-sm bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">无匹配选项</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => toggleOption(option.value)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                    value.includes(option.value) && 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  )}
                >
                  <Checkbox checked={value.includes(option.value)} className="pointer-events-none" />
                  <span>{option.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
