'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { zhCN } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
}

const rdpThemeVars = {
  '--rdp-accent-color': 'var(--primary)',
  '--rdp-accent-background-color': 'color-mix(in oklab, var(--primary) 15%, transparent)',
  '--rdp-day-width': '2.5rem',
  '--rdp-day-height': '2.5rem',
  '--rdp-day_button-width': '2.25rem',
  '--rdp-day_button-height': '2.25rem',
  '--rdp-nav_button-width': '2rem',
  '--rdp-nav_button-height': '2rem',
} as CSSProperties

/**
 * 日期范围选择：点击弹出日历，一次选择开始+结束两个日期。
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = '选择日期范围',
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (range: DateRange | undefined) => {
    onChange(range)
    if (range?.from && range?.to) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-9 w-full justify-start font-normal',
            !value?.from && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, 'yyyy-MM-dd')} ~ {format(value.to, 'yyyy-MM-dd')}
              </>
            ) : (
              <>
                {format(value.from, 'yyyy-MM-dd')} ~ <span className="text-muted-foreground">请选择结束日期</span>
              </>
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <DayPicker
          mode="range"
          selected={value}
          onSelect={handleSelect}
          locale={zhCN}
          numberOfMonths={2}
          defaultMonth={value?.from}
          showOutsideDays
          style={rdpThemeVars}
        />
      </PopoverContent>
    </Popover>
  )
}
