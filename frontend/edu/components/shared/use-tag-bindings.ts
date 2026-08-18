'use client'

import { useCallback, useState, useRef } from 'react'
import { tagApi } from '@/lib/api'
import type { TagItem, TagResourceType } from '@/lib/types/library'

/**
 * 列表页资源标签绑定 hook：
 * - loadBindings：批量拉取一页资源的标签（列表展示用）
 * - saveTags：全量替换某资源的标签绑定（表单保存用）
 */
export function useTagBindings(resourceType: TagResourceType) {
  // 请求序号：快速翻页时丢弃过期响应
  const loadSeqRef = useRef(0)
  const [tagsByResource, setTagsByResource] = useState<Record<string, TagItem[]>>({})
  const [loading, setLoading] = useState(false)

  const loadBindings = useCallback(
    async (items: { id: string }[]) => {
      const ids = items.map((i) => i.id)
      if (ids.length === 0) {
        setTagsByResource({})
        return
      }
      const seq = ++loadSeqRef.current
      setLoading(true)
      try {
        const res = await tagApi.queryBindings({ resourceType, resourceIds: ids })
        if (seq !== loadSeqRef.current) return
        const map: Record<string, TagItem[]> = {}
        for (const rel of res.items || []) map[rel.resourceId] = rel.tags
        setTagsByResource(map)
      } catch {
        if (seq !== loadSeqRef.current) return
        setTagsByResource({})
      } finally {
        if (seq === loadSeqRef.current) setLoading(false)
      }
    },
    [resourceType],
  )

  const saveTags = useCallback(
    async (resourceId: string, tagIds: string[]) => {
      await tagApi.setBindings({ resourceType, resourceId, tagIds })
    },
    [resourceType],
  )

  return { tagsByResource, loadBindings, saveTags, loading }
}
