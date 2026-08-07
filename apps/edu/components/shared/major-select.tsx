'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { majorApi } from '@/lib/api'
import { fetchAllPages } from '@/lib/fetch-all'
import { useT } from '@/lib/i18n/locale-provider'
import type { Major } from '@/lib/types/backend'

interface MajorSelectProps {
  tenantId?: string
  value?: string
  /** 变更回调；第二参为选中专业实体（onChange 签名向后兼容扩展） */
  onChange: (value: string | undefined, major?: Major) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function MajorSelect({
  tenantId,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: MajorSelectProps) {
  const t = useT()
  const [majors, setMajors] = useState<Major[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  const loadMajors = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const params: { tenantId?: string } = {}
      if (tenantId) {
        params.tenantId = tenantId
      }
      // 分页合并全量拉取，避免超过后端 maxPageSize(200) 静默截断
      const items = await fetchAllPages((page, pageSize) =>
        majorApi.list({ ...params, limit: pageSize, offset: page * pageSize }),
      )
      setMajors(items.filter((m) => m.enabled))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('加载专业失败'))
    } finally {
      setLoading(false)
    }
  }, [tenantId, t])

  useEffect(() => {
    ;(async () => {
      await loadMajors()
    })()
  }, [loadMajors])

  const handleChange = (val: string) => {
    onChange(
      val || undefined,
      majors.find((m) => m.id === val),
    )
  }

  const isDisabled = disabled || loading

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>
  }

  return (
    <Select value={value || ''} onValueChange={handleChange} disabled={isDisabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder ?? t('选择专业')} />
      </SelectTrigger>
      <SelectContent>
        {majors.map((major) => (
          <SelectItem key={major.id} value={major.id}>
            {major.name}
            {major.code ? (
              <span className="ml-2 text-xs text-muted-foreground">({major.code})</span>
            ) : null}
          </SelectItem>
        ))}
        {majors.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">{t('暂无专业')}</div>
        )}
      </SelectContent>
    </Select>
  )
}
