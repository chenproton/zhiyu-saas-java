'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BatchSelectorProps {
  value: string
  onChange: (batchId: string) => void
  batchApi: {
    list: (params?: Record<string, any>) => Promise<{ items: { id: string; name: string }[] }>
  }
  label?: string
  placeholder?: string
  emptyLabel?: string
}

export function BatchSelector({
  value,
  onChange,
  batchApi,
  label,
  placeholder,
  emptyLabel,
}: BatchSelectorProps) {
  const t = useT()
  const labelText = label ?? t('所属批次')
  const placeholderText = placeholder ?? t('请选择批次')
  const emptyLabelText = emptyLabel ?? t('不关联批次')
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    let cancelled = false
    batchApi
      .list({ limit: 1000 })
      .then((res) => {
        if (!cancelled) setBatches(res.items)
      })
      .catch((err) => reportError(err, { source: '加载批次列表' }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{labelText}</Label>
      <Select
        value={value || '__none__'}
        onValueChange={(v) => onChange(v === '__none__' ? '' : v)}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={placeholderText} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{emptyLabelText}</SelectItem>
          {batches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
