'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

/** 轻量自由输入标签组件：Enter/逗号添加，点击标签删除（纯展示字段用，无业务校验） */
export function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const t = useT()
  const [draft, setDraft] = useState('')

  const addTags = (raw: string) => {
    const tags = raw
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (tags.length === 0) return
    onChange([...value, ...tags.filter((tag) => !value.includes(tag))])
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        placeholder={placeholder || t('输入后回车添加')}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTags(draft)
          }
        }}
        onBlur={() => {
          if (draft.trim()) addTags(draft)
        }}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 font-normal pr-1">
              {tag}
              <button
                type="button"
                className="rounded-full hover:bg-foreground/10 p-0.5"
                onClick={() => onChange(value.filter((v) => v !== tag))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
