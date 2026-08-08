'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

interface ComboboxSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface BaseComboboxSelectProps {
  options: ComboboxSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  loading?: boolean
  renderOption?: (option: ComboboxSelectOption, selected: boolean) => React.ReactNode
}

interface SingleComboboxSelectProps extends BaseComboboxSelectProps {
  value: string
  onChange: (value: string) => void
  multiple?: false
}

interface MultipleComboboxSelectProps extends BaseComboboxSelectProps {
  value: string[]
  onChange: (value: string[]) => void
  multiple: true
}

type ComboboxSelectProps = SingleComboboxSelectProps | MultipleComboboxSelectProps

/**
 * ComboboxSelect
 *
 * 统一的可搜索下拉选择组件，支持单选/多选。
 * 用于替换散落在各页面中的 inline 搜索 + Select/Popover 实现。
 */
export function ComboboxSelect(props: ComboboxSelectProps) {
  const {
    options,
    placeholder = '选择...',
    searchPlaceholder = '搜索...',
    emptyText = '无结果',
    className,
    disabled,
    loading,
    renderOption,
  } = props
  const isMultiple = props.multiple === true
  const [open, setOpen] = useState(false)

  const selectedSet = useMemo(() => {
    if (isMultiple) return new Set(props.value)
    return props.value ? new Set([props.value]) : new Set<string>()
  }, [isMultiple, props.value])

  const displayLabel = useMemo(() => {
    if (isMultiple) {
      if (props.value.length === 0) return placeholder
      if (props.value.length === 1)
        return options.find((o) => o.value === props.value[0])?.label || props.value[0]
      return `已选 ${props.value.length} 项`
    }
    if (!props.value) return placeholder
    return options.find((o) => o.value === props.value)?.label || props.value
  }, [isMultiple, props.value, options, placeholder])

  const toggleValue = (v: string) => {
    if (isMultiple) {
      const next = new Set(props.value)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      props.onChange(Array.from(next))
    } else {
      props.onChange(v)
      setOpen(false)
    }
  }

  const clearValue = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isMultiple) props.onChange([])
    else props.onChange('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            'h-8 justify-between font-normal',
            !props.value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <div className="flex items-center shrink-0 ml-2">
            {((isMultiple && (props.value as string[]).length > 0) ||
              (!isMultiple && props.value)) &&
              !disabled && (
                <button
                  type="button"
                  aria-label="清除选择"
                  className="rounded-sm hover:bg-muted p-0.5"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearValue(e)
                  }}
                >
                  <X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" />
                </button>
              )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[200px]">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const selected = selectedSet.has(o.value)
                return (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    disabled={o.disabled}
                    onSelect={() => toggleValue(o.value)}
                  >
                    {renderOption ? (
                      renderOption(o, selected)
                    ) : (
                      <>
                        <Check
                          className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')}
                        />
                        {o.label}
                      </>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
