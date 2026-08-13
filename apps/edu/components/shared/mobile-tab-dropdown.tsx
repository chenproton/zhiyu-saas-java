'use client'

import { useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useClickOutside } from '@zhiyu/ui'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'

export interface MobileTabItem {
  value: string
  label: string
  icon?: LucideIcon
  count?: number
}

interface MobileTabDropdownProps {
  items: MobileTabItem[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

/**
 * 移动端（<md）tab 下拉选择器：替代窄屏下横向滚动 / 折行的 tab 栏。
 * 桌面端保持原有 tab 栏，此组件仅在 md 以下渲染（配合 `md:hidden` 使用）。
 */
export function MobileTabDropdown({
  items,
  value,
  onValueChange,
  className,
}: MobileTabDropdownProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = items.find((i) => i.value === value) ?? items[0]

  useClickOutside(ref, () => setOpen(false))

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-2 h-11 pl-4 pr-3 rounded-xl border border-[#e7e5e4] bg-white text-sm font-medium text-[#0f172a] shadow-sm cursor-pointer hover:border-primary/30 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          {active?.icon && <active.icon className="w-4 h-4 text-primary shrink-0" />}
          <span className="truncate">{active?.label ?? t('请选择')}</span>
          {typeof active?.count === 'number' && active.count > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[11px] leading-none bg-primary/10 text-primary shrink-0">
              {active.count}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-[#94a3b8] shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-xl border border-[#e7e5e4] bg-white shadow-lg overflow-hidden"
        >
          {items.map((item) => {
            const isActive = item.value === value
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onValueChange(item.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-4 py-3 text-sm text-left cursor-pointer transition-colors',
                  isActive
                    ? 'bg-primary/5 text-primary font-medium'
                    : 'text-[#475569] hover:bg-[#f8fafc]',
                )}
              >
                {item.icon && (
                  <item.icon
                    className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-slate-400')}
                  />
                )}
                <span className="truncate">{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[11px] leading-none bg-slate-100 text-slate-500 shrink-0">
                    {item.count}
                  </span>
                )}
                {isActive && <Check className="w-4 h-4 text-primary ml-auto shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
