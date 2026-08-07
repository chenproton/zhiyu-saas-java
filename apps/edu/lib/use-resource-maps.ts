'use client'

import { useState, useEffect } from 'react'
import { industryApi, majorApi } from '@/lib/api'
import { fetchAllPages } from './fetch-all'
import { reportError } from './error-handling'

export function useIndustryMap() {
  const [map, setMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    fetchAllPages((page, pageSize) => industryApi.list({ limit: pageSize, offset: page * pageSize }))
      .then((items) => {
        const nameMap = new Map<string, string>()
        items.forEach((item) => {
          if (item.name) nameMap.set(item.id, item.name)
        })
        setMap(nameMap)
      })
      .catch((err) => reportError(err, { source: '加载行业字典' }))
  }, [])

  return map
}

export function useMajorMap() {
  const [map, setMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    fetchAllPages((page, pageSize) => majorApi.list({ limit: pageSize, offset: page * pageSize }))
      .then((items) => {
        const nameMap = new Map<string, string>()
        items.forEach((item) => {
          if (item.name) nameMap.set(item.id, item.name)
        })
        setMap(nameMap)
      })
      .catch((err) => reportError(err, { source: '加载专业字典' }))
  }, [])

  return map
}
