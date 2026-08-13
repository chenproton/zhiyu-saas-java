'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface UnderlineTabItem {
  key: string
  label: React.ReactNode
  badge?: number | string
}

export interface UnderlineTabsProps {
  items: UnderlineTabItem[]
  activeKey: string
  onSelect: (key: string) => void
  accentClassName?: string
  className?: string
  buttonClassName?: string
}

export function UnderlineTabs({
  items,
  activeKey,
  onSelect,
  accentClassName,
  className,
  buttonClassName,
}: UnderlineTabsProps) {
  return (
    <div className={cn('flex border-b gap-0 overflow-x-auto', className)}>
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          className={cn(
            'px-4 py-2 text-sm border-b-2 transition-colors whitespace-nowrap',
            activeKey === t.key
              ? cn('border-primary text-primary font-medium', accentClassName)
              : 'border-transparent text-muted-foreground hover:text-foreground',
            buttonClassName,
          )}
        >
          {t.label}
          {t.badge !== undefined && (
            <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  )
}
