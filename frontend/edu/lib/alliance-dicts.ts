'use client'

import { useEffect, useMemo, useState } from 'react'
import { registerAllianceDicts } from '@zhiyu/shared-types'
import { portalRequest } from '@/lib/api'

export interface AllianceDictItem {
  id: string
  code: string
  name: string
  sortOrder: number
}

/** 联盟业务字典类型（与 /portal/apps/alliance/dictionaries 管理页一一对应） */
export const ALLIANCE_DICT_TYPES = [
  'cooperation_type',
  'cooperation_rating',
  'enterprise_status',
  'achievement_type',
  'agreement_type',
  'agreement_status',
  'expert_rating',
  'project_type',
] as const

export type AllianceDictType = (typeof ALLIANCE_DICT_TYPES)[number]

/** 字典类型 → ALLIANCE_DICTS 展示键（allianceLabel 用）映射；展示层有静态映射的才注册 */
const DICT_TYPE_TO_LABEL_KEY: Record<string, string> = {
  cooperation_rating: 'enterpriseRating',
  enterprise_status: 'enterpriseStatus',
  achievement_type: 'achievementType',
  agreement_status: 'agreementStatus',
  expert_rating: 'expertRating',
}

// module 级缓存：同一租户同一字典类型只请求一次，跨页面共享
const cache = new Map<string, Promise<AllianceDictItem[]>>()

export function fetchAllianceDict(
  tenantId: string,
  dictType: string,
): Promise<AllianceDictItem[]> {
  const key = `${tenantId}:${dictType}`
  let p = cache.get(key)
  if (!p) {
    p = portalRequest<{ items: AllianceDictItem[] }>(`/alliance/dictionaries/${dictType}`)
      .then((r) => r.items || [])
      .catch(() => {
        // 失败不缓存：下次调用可重试，避免一次瞬时错误导致整会话该字典恒为空
        cache.delete(key)
        return []
      })
    cache.set(key, p)
  }
  return p
}

/** 拉取单个字典：表单下拉选项（按 sortOrder 升序） */
export function useAllianceDictionary(
  dictType: string,
  tenantId?: string,
): {
  items: AllianceDictItem[]
  loading: boolean
} {
  const [items, setItems] = useState<AllianceDictItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    fetchAllianceDict(tenantId, dictType).then((list) => {
      if (cancelled) return
      setItems(list)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [tenantId, dictType])

  return useMemo(() => ({ items, loading }), [items, loading])
}

/** 合并字典与存量值：当前值不在字典中时追加为选项，保证存量数据可正常展示/编辑 */
export function mergeDictOptions(
  items: AllianceDictItem[],
  currentValue?: string | null,
): { label: string; value: string }[] {
  const opts = items.map((d) => ({ label: d.name, value: d.code }))
  if (currentValue && !items.some((d) => d.code === currentValue)) {
    opts.unshift({ label: currentValue, value: currentValue })
  }
  return opts
}

/**
 * 全局展示字典注册：登录后拉取全部联盟字典并注册到 allianceLabel，
 * 使列表/详情页展示文案跟随字典管理页配置（改名/新增即时生效）。
 */
export function useRegisterAllianceDicts(tenantId?: string) {
  useEffect(() => {
    if (!tenantId) return
    Promise.all(ALLIANCE_DICT_TYPES.map((t) => fetchAllianceDict(tenantId, t))).then((lists) => {
      const dicts: Record<string, Record<string, string>> = {}
      lists.forEach((list, idx) => {
        const key = DICT_TYPE_TO_LABEL_KEY[ALLIANCE_DICT_TYPES[idx]]
        if (!key) return
        dicts[key] = {}
        list.forEach((d) => {
          dicts[key][d.code] = d.name
        })
      })
      registerAllianceDicts(dicts)
    })
  }, [tenantId])
}
