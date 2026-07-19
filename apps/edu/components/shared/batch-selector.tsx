"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface BatchSelectorProps {
  value: string
  onChange: (batchId: string) => void
  batchApi: { list: (params?: Record<string, any>) => Promise<{ items: { id: string; name: string }[] }> }
  label?: string
  placeholder?: string
  emptyLabel?: string
}

export function BatchSelector({
  value,
  onChange,
  batchApi,
  label = "所属批次",
  placeholder = "请选择批次",
  emptyLabel = "不关联批次",
}: BatchSelectorProps) {
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    batchApi.list({ limit: 1000 }).then((res) => setBatches(res.items)).catch(() => {})
  }, [])

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{emptyLabel}</SelectItem>
          {batches.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
