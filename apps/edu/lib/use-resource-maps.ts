'use client'

import { useEffect, useState } from 'react'
import { industryApi, majorApi } from '@/lib/api'
import { fetchAllPages } from './fetch-all'
import { reportError } from './error-handling'

// 模块级缓存：多个页面共享行业/专业字典，避免重复全量拉取
let cachedIndustries: Map<string, string> | null = null
let cachedMajors: Map<string, string> | null = null
let industryInflight: Promise<void> | null = null
let majorInflight: Promise<void> | null = null

async function loadIndustries(): Promise<void> {
  industryInflight =
    industryInflight ??
    fetchAllPages((page, pageSize) => industryApi.list({ limit: pageSize, offset: page * pageSize }))
      .then((items) => {
        const nameMap = new Map<string, string>()
        items.forEach((item) => {
          if (item.name) nameMap.set(item.id, item.name)
        })
        cachedIndustries = nameMap
      })
      .finally(() => {
        industryInflight = null
      })
  return industryInflight
}

async function loadMajors(): Promise<void> {
  majorInflight =
    majorInflight ??
    fetchAllPages((page, pageSize) => majorApi.list({ limit: pageSize, offset: page * pageSize }))
      .then((items) => {
        const nameMap = new Map<string, string>()
        items.forEach((item) => {
          if (item.name) nameMap.set(item.id, item.name)
        })
        cachedMajors = nameMap
      })
      .finally(() => {
        majorInflight = null
      })
  return majorInflight
}

export function useIndustryMap() {
  const [map, setMap] = useState<Map<string, string>>(cachedIndustries ?? new Map())

  useEffect(() => {
    let cancelled = false
    if (cachedIndustries) return
    loadIndustries()
      .then(() => {
        if (!cancelled && cachedIndustries) setMap(cachedIndustries)
      })
      .catch((err) => reportError(err, { source: '加载行业字典' }))
    return () => {
      cancelled = true
    }
  }, [])

  return map
}

export function useMajorMap() {
  const [map, setMap] = useState<Map<string, string>>(cachedMajors ?? new Map())

  useEffect(() => {
    let cancelled = false
    if (cachedMajors) return
    loadMajors()
      .then(() => {
        if (!cancelled && cachedMajors) setMap(cachedMajors)
      })
      .catch((err) => reportError(err, { source: '加载专业字典' }))
    return () => {
      cancelled = true
    }
  }, [])

  return map
}
