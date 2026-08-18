'use client'

// AI 大厅筛选/表单共用的分类字典 hook（v2.4）：系统专业字典（majors）+ 系统院系字典
//（organizations 中类型为「二级学院/院系/系部」的节点；找不到该类型时退化为学校直属第二级）。
import { useEffect, useState } from 'react'
import { majorApi, orgApi, orgTypeApi } from '@/lib/api'

export interface DictOption {
  id: string
  name: string
}

interface OrgNode {
  id: string
  name: string
  typeId: string
  children?: OrgNode[]
}

export function useClassifyDicts() {
  const [majors, setMajors] = useState<DictOption[]>([])
  const [departments, setDepartments] = useState<DictOption[]>([])

  useEffect(() => {
    let cancelled = false
    majorApi
      .list({ page: 1, pageSize: 500, enabled: true })
      .then((res) => {
        if (!cancelled) setMajors((res.items || []).map((m) => ({ id: m.id, name: m.name })))
      })
      .catch(() => {})

    // 院系：优先按类型名匹配「二级学院/院系/系部」，取该类型下组织
    ;(async () => {
      try {
        const types = await orgTypeApi.list({ page: 1, pageSize: 100 })
        const deptType = (types.items || []).find((t) => /二级学院|院系|系部/.test(t.name))
        if (deptType) {
          const res = await orgApi.list({ page: 1, pageSize: 200, typeId: deptType.id })
          if (!cancelled) setDepartments((res.items || []).map((o) => ({ id: o.id, name: o.name })))
          return
        }
        // 兜底：组织树的第二级（学校直属单位）
        const tree = await orgApi.tree()
        const roots = (tree.items || []) as OrgNode[]
        const level2 = roots.flatMap((r) => r.children || [])
        if (!cancelled) setDepartments(level2.map((o) => ({ id: o.id, name: o.name })))
      } catch {
        /* 字典加载失败则筛选项为空 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { majors, departments }
}
