'use client'

import { useRef, useState, useEffect } from 'react'

const ACCENT_CLASSES: Record<
  string,
  {
    selected: string
    unselected: string
    expand: string
    border: string
  }
> = {
  purple: {
    selected: 'bg-purple-500 text-white border-purple-500 shadow-sm',
    unselected:
      'bg-slate-50 text-[#475569] border-slate-200 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50/50',
    expand: 'text-purple-500 hover:text-purple-600',
    border: 'border-b border-dashed border-[#cbd5e1]',
  },
  emerald: {
    selected: 'bg-emerald-500 text-white border-emerald-500 shadow-sm',
    unselected:
      'bg-slate-50 text-[#475569] border-slate-200 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/50',
    expand: 'text-emerald-500 hover:text-emerald-600',
    border: 'border-b border-dashed border-[#cbd5e1]',
  },
  blue: {
    selected: 'bg-blue-500 text-white border-blue-500 shadow-sm',
    unselected:
      'bg-slate-50 text-[#475569] border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50',
    expand: 'text-blue-500 hover:text-blue-600',
    border: 'border-b border-dashed border-[#cbd5e1]',
  },
}

interface LandingFilterRowProps {
  label: string
  items: string[]
  selected: string
  onSelect: (item: string) => void
  showBorder?: boolean
  accentColor?: 'purple' | 'emerald' | 'blue'
}

export function LandingFilterRow({
  label,
  items,
  selected,
  onSelect,
  showBorder = true,
  accentColor = 'purple',
}: LandingFilterRowProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 2)
  }, [items])

  const cls = ACCENT_CLASSES[accentColor] || ACCENT_CLASSES.purple

  if (items.length <= 1) return null

  return (
    <div className={`flex items-start gap-3 sm:gap-4 py-3 ${showBorder ? cls.border : ''}`}>
      <span className="text-sm text-[#374151] font-medium min-w-[40px] pt-1.5">{label}</span>
      <div className="flex-1 min-w-0">
        <div
          ref={containerRef}
          className={`flex flex-wrap gap-2.5 ${expanded ? '' : 'max-h-[80px] overflow-hidden'}`}
        >
          {items.map((item) => (
            <button
              key={item}
              onClick={() => onSelect(item)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] border transition-all whitespace-nowrap ${
                selected === item ? cls.selected : cls.unselected
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        {overflow && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`text-[12px] ${cls.expand} mt-1.5 font-medium`}
          >
            {expanded ? '收起' : '展开'}
          </button>
        )}
      </div>
    </div>
  )
}
