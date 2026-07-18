"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { majorApi } from "@/lib/api"
import { useOrgTree } from "@/hooks/use-org-tree"
import type { Major } from "@/lib/types/backend"

interface MajorSelectProps {
  tenantId?: string
  orgNodeId?: string
  value?: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function MajorSelect({
  tenantId,
  orgNodeId,
  value,
  onChange,
  placeholder = "选择专业",
  disabled,
  className,
}: MajorSelectProps) {
  const [majors, setMajors] = useState<Major[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const { orgTree } = useOrgTree(orgNodeId ? tenantId : undefined)

  const loadMajors = useCallback(async () => {
    if (!tenantId) {
      setMajors([])
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const res = await majorApi.list({ tenantId, limit: 1000 })
      setMajors(res.items.filter((m) => m.enabled))
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载专业失败")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    loadMajors()
  }, [loadMajors])

  // 专业可能绑定在院系节点或院系下属的「专业」类型节点上，
  // 因此按所选院系的整个子树过滤；未绑定组织节点的专业始终可选。
  const subtreeIds = useMemo(() => {
    if (!orgNodeId || orgTree.length === 0) return null
    const childrenMap = new Map<string, string[]>()
    orgTree.forEach((n) => {
      if (!n.parentId) return
      const list = childrenMap.get(n.parentId) || []
      list.push(n.id)
      childrenMap.set(n.parentId, list)
    })
    const ids = new Set<string>()
    const stack = [orgNodeId]
    while (stack.length > 0) {
      const id = stack.pop()!
      if (ids.has(id)) continue
      ids.add(id)
      const children = childrenMap.get(id)
      if (children) stack.push(...children)
    }
    return ids
  }, [orgNodeId, orgTree])

  const visibleMajors = useMemo(() => {
    if (!orgNodeId) return majors
    if (!subtreeIds) return majors
    return majors.filter((m) => !m.orgNodeId || subtreeIds.has(m.orgNodeId))
  }, [majors, orgNodeId, subtreeIds])

  const handleChange = (val: string) => {
    onChange(val || undefined)
  }

  const isDisabled = disabled || loading || !tenantId

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>
  }

  return (
    <Select value={value || ""} onValueChange={handleChange} disabled={isDisabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {visibleMajors.map((major) => (
          <SelectItem key={major.id} value={major.id}>
            {major.name}
            {major.code ? <span className="ml-2 text-xs text-muted-foreground">({major.code})</span> : null}
          </SelectItem>
        ))}
        {visibleMajors.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            {!orgNodeId ? "暂无专业" : "该院系下暂无专业"}
          </div>
        )}
      </SelectContent>
    </Select>
  )
}
