'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Separator } from '@/components/ui/separator'
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
  showSelectAll?: boolean
  showSelectedBadges?: boolean
  selectAllLabel?: string
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
 * 统一的可搜索下拉选择组件，支持单选/多选、全选（showSelectAll）与已选徽章（showSelectedBadges）。
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
    showSelectAll,
    showSelectedBadges,
    selectAllLabel = '全选',
    renderOption,
  } = props
  const isMultiple = props.multiple === true
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedSet = useMemo(() => {
    if (isMultiple) return new Set(props.value)
    return props.value ? new Set([props.value]) : new Set<string>()
  }, [isMultiple, props.value])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, search])

  const displayLabel = useMemo(() => {
    if (isMultiple) {
      if (props.value.length === 0) return placeholder
      // 多选直接展示全部选中项名称（触发器已 truncate，超长省略），不再折叠为"已选 N 项"
      return props.value
        .map((v) => options.find((o) => o.value === v)?.label || v)
        .join('、')
    }
    if (!props.value) return placeholder
    return options.find((o) => o.value === props.value)?.label || props.value
  }, [isMultiple, props.value, options, placeholder])

  const selectedEntries = useMemo(() => {
    if (!isMultiple) return []
    return props.value
      .map((v) => options.find((o) => o.value === v))
      .filter((o): o is ComboboxSelectOption => Boolean(o))
  }, [isMultiple, props.value, options])

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

  const toggleAllVisible = () => {
    if (!isMultiple) return
    const visible = filtered.filter((o) => !o.disabled).map((o) => o.value)
    if (visible.length === 0) return
    const allSelected = visible.every((v) => selectedSet.has(v))
    if (allSelected) {
      props.onChange(props.value.filter((v) => !visible.includes(v)))
    } else {
      props.onChange(Array.from(new Set([...props.value, ...visible])))
    }
  }

  const allVisibleSelected =
    isMultiple &&
    filtered.filter((o) => !o.disabled).length > 0 &&
    filtered.filter((o) => !o.disabled).every((o) => selectedSet.has(o.value))

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        // 关闭时清空搜索词，再次打开不残留上次过滤条件
        if (!v) setSearch('')
      }}
    >
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
        <Command shouldFilter={false}>
          <CommandInput
            autoComplete="off"
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          {showSelectAll && isMultiple && filtered.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} />
              <span className="text-xs text-muted-foreground">{selectAllLabel}</span>
            </div>
          )}
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filtered.map((o) => {
                const selected = selectedSet.has(o.value)
                return (
                  <CommandItem
                    key={o.value}
                    // value 需同时满足唯一性与可搜索性（label 搜索），拼接 value 避免重复 label 冲突
                    value={`${o.label}:${o.value}`}
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
          {showSelectedBadges && isMultiple && props.value.length > 0 && (
            <>
              <Separator />
              <div className="p-2 flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
                {selectedEntries.map((o) => (
                  <Badge key={o.value} variant="secondary" className="text-xs gap-1">
                    {o.label}
                    <button
                      type="button"
                      aria-label={`移除${o.label}`}
                      onClick={() => toggleValue(o.value)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
