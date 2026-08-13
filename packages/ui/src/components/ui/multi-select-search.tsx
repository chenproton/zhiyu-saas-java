'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface MultiSelectOption {
  label: string
  value: string
  subtitle?: string
}

interface MultiSelectSearchProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  triggerClassName?: string
}

export function MultiSelectSearch({
  options,
  selected,
  onChange,
  placeholder = '请选择',
  searchPlaceholder = '搜索...',
  emptyText = '暂无选项',
  className,
  triggerClassName,
}: MultiSelectSearchProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.subtitle && o.subtitle.toLowerCase().includes(q)),
    )
  }, [options, search])

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const toggleAll = () => {
    const visibleValues = filtered.map((o) => o.value)
    const allSelected = visibleValues.every((v) => selected.includes(v))
    if (allSelected) {
      onChange(selected.filter((v) => !visibleValues.includes(v)))
    } else {
      const newSelected = new Set([...selected, ...visibleValues])
      onChange(Array.from(newSelected))
    }
  }

  const isAllSelected = filtered.length > 0 && filtered.every((o) => selected.includes(o.value))

  const selectedLabels = useMemo(() => {
    return selected
      .map((v) => options.find((o) => o.value === v)?.label)
      .filter(Boolean) as string[]
  }, [selected, options])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-between font-normal h-auto min-h-9 py-1.5',
            triggerClassName,
          )}
        >
          <span className="truncate">
            {selected.length === 0 ? (
              placeholder
            ) : selectedLabels.length <= 2 ? (
              selectedLabels.join('、')
            ) : (
              <span className="flex items-center gap-1 flex-wrap">
                {selectedLabels.slice(0, 2).map((label, idx) => (
                  <span key={label}>
                    {label}
                    {idx < Math.min(selectedLabels.length, 2) - 1 ? '、' : ''}
                  </span>
                ))}
                <span className="text-muted-foreground">+{selectedLabels.length - 2}</span>
              </span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[320px] p-0', className)} align="start">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              autoComplete="off"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 text-sm"
            />
          </div>
        </div>
        <Separator />
        {filtered.length > 0 && (
          <div className="px-3 py-1.5 flex items-center gap-2">
            <Checkbox checked={isAllSelected} onCheckedChange={toggleAll} id="multi-select-all" />
            <label
              htmlFor="multi-select-all"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              全选
            </label>
          </div>
        )}
        <ScrollArea className="h-[200px] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
              {search ? '未找到匹配项' : emptyText}
            </div>
          ) : (
            <div className="p-1">
              {filtered.map((option) => {
                const isSelected = selected.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted',
                      isSelected && 'bg-muted/50',
                    )}
                  >
                    <Checkbox checked={isSelected} onCheckedChange={() => toggle(option.value)} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{option.label}</span>
                      {option.subtitle && (
                        <span className="text-xs text-muted-foreground ml-1">
                          {option.subtitle}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </label>
                )
              })}
            </div>
          )}
        </ScrollArea>
        {selected.length > 0 && (
          <>
            <Separator />
            <div className="p-2 flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
              {selectedLabels.map((label) => (
                <Badge key={label} variant="secondary" className="text-xs gap-1">
                  {label}
                  <button
                    type="button"
                    aria-label={`移除${label}`}
                    onClick={() => {
                      const val = options.find((o) => o.label === label)?.value
                      if (val) toggle(val)
                    }}
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
