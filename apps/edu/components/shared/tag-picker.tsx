'use client'

import { Check } from 'lucide-react'
import { ComboboxSelect } from '@/components/shared/combobox-select'
import { useTags } from './use-tags'

interface TagPickerProps {
  value: string[]
  onChange: (value: string[]) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

/**
 * 表单标签多选器：可搜索、支持多选，选项带标签色点标识。
 * 标签数据经 useTags 模块级缓存，所有表单共用一份。
 */
export function TagPicker({
  value,
  onChange,
  className,
  placeholder = '选择标签...',
  disabled,
}: TagPickerProps) {
  const { tags, loading } = useTags()

  return (
    <ComboboxSelect
      multiple
      value={value}
      onChange={onChange}
      options={tags.map((t) => ({ value: t.id, label: t.name }))}
      placeholder={placeholder}
      searchPlaceholder="搜索标签..."
      emptyText="暂无标签，请先在标签管理页创建"
      loading={loading}
      disabled={disabled}
      className={className}
      renderOption={(o, selected) => {
        const tag = tags.find((t) => t.id === o.value)
        return (
          <div className="flex items-center gap-2 w-full">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: tag?.color || '#94a3b8' }}
            />
            <span className="flex-1">{o.label}</span>
            {selected && <Check className="h-4 w-4 text-primary" />}
          </div>
        )
      }}
    />
  )
}
