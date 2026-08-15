'use client'

// 引用溯源展示（spec §5.5 sources 事件 / 历史消息 message.sources）：
// 折叠「参考来源（N）」区，展开后列出 docName + 第{seq}段 + snippet。
import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import type { AIMessageSource } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

export function AISourceList({ sources }: { sources: AIMessageSource[] }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  if (!sources || sources.length === 0) return null
  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {t('参考来源（{count}）', { count: sources.length })}
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {sources.map((s, i) => (
            <li
              key={`${s.docId}-${s.seq}-${i}`}
              className="rounded-md bg-background/60 border border-gray-100 px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.docName}</span>
                <span className="text-muted-foreground shrink-0">
                  {t('第 {seq} 段', { seq: s.seq })}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground whitespace-pre-wrap break-words line-clamp-3">
                {s.snippet}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
