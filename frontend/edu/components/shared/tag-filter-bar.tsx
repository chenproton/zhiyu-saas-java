'use client'

import { ChevronDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTags } from './use-tags'
import { useT } from '@/lib/i18n/locale-provider'

interface TagFilterBarProps {
  value: string[]
  onChange: (tagIds: string[]) => void
  className?: string
}

/** 两行高度（每行标签高度 + 行间距 gap-2） */
const ROW_GAP = 8

/**
 * 列表顶部标签筛选栏：标签云多选（OR 语义，命中任一标签即显示）。
 * 与搜索条件叠加生效；无标签数据时展示引导文案。
 * 默认仅展示两行，超出折叠，可通过展开/收起按钮反复切换。
 */
export function TagFilterBar({ value, onChange, className }: TagFilterBarProps) {
  const t = useT()
  const { tags, loading } = useTags()
  const selected = new Set(value)
  const tagsRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(true)
  const [rowHeight, setRowHeight] = useState(0)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const el = tagsRef.current
    const first = el?.querySelector('button')
    if (!el || !first) return
    const h = first.offsetHeight
    setRowHeight(h)
    setOverflow(el.scrollHeight > h * 2 + ROW_GAP)
  }, [tags.length])

  const toggle = (id: string) => {
    const next = new Set(value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next))
  }

  if (loading) return null
  if (tags.length === 0) {
    return (
      <div
        className={`bg-white rounded-xl p-3 border border-slate-100 shadow-sm ${className ?? ''}`}
      >
        <span className="text-sm text-slate-400">
          {t('暂无标签，请先在「标签管理」中创建后再进行标签筛选')}
        </span>
      </div>
    )
  }

  const maxHeight = collapsed && rowHeight > 0 ? rowHeight * 2 + ROW_GAP : undefined

  return (
    <div
      className={`bg-white rounded-xl p-3 flex gap-2 flex-wrap items-center border border-slate-100 shadow-sm ${className ?? ''}`}
    >
      <span className="text-sm text-slate-400 mr-1 shrink-0">{t('标签筛选：')}</span>
      <div
        ref={tagsRef}
        className="flex gap-2 flex-wrap items-center min-w-0"
        style={{ maxHeight, overflow: maxHeight ? 'hidden' : undefined }}
      >
        {tags.map((tag) => {
          const active = selected.has(tag.id)
          return (
            <button
              key={tag.id}
              onClick={() => toggle(tag.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border-none"
              style={{
                background: active ? tag.color : '#f8fafc',
                color: active ? '#fff' : '#64748b',
                border: `1px solid ${active ? tag.color : '#e2e8f0'}`,
                boxShadow: active ? `0 2px 8px ${tag.color}30` : 'none',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: active ? '#fff' : tag.color }}
              />
              {tag.name}
              {active && <X className="size-3 ml-0.5" />}
            </button>
          )
        })}
      </div>
      {value.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="ml-auto px-3 py-1.5 text-xs text-red-400 hover:text-red-600 font-medium border border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors"
        >
          {t('清除筛选')}
        </button>
      )}
      {overflow && (
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer ml-auto"
        >
          {collapsed ? t('展开') : t('收起')}
          <ChevronDown
            className={`size-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>
      )}
    </div>
  )
}
