'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { portalRequest } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'
import type { AllianceListResponse } from '@/lib/types'

interface Option {
  label: string
  value: string
}

interface BrandRelationFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  fetchUrl: string
  optional?: boolean
}

/** 品牌关联对象选择器：从后端列表拉取选项（企业/岗位/专业/教师/专家等） */
export function BrandRelationSelect({
  label,
  value,
  onChange,
  placeholder,
  fetchUrl,
  optional = true,
}: BrandRelationFieldProps) {
  const t = useT()
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    portalRequest<AllianceListResponse<any>>(fetchUrl)
      .then((res) => {
        if (cancelled) return
        const opts = (res.items || [])
          .map((x: any) => ({ label: x.name || x.title || x.accountName || x.id, value: x.id }))
          .filter((o: Option) => o.label)
        setOptions(opts)
      })
      .catch((err) => reportError(err, `加载关联对象选项（${fetchUrl}）`))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [fetchUrl])

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select
        value={value || '__none'}
        onValueChange={(v) => onChange(v === '__none' ? '' : v)}
        disabled={loading}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={loading ? t('加载中...') : (placeholder ?? t('选择关联对象'))}
          />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value="__none">{t('不关联')}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          {options.length === 0 && !loading && (
            <SelectItem value="__none" disabled>
              {t('暂无选项')}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
