'use client'

import { useState, useEffect } from 'react'
import { industryApi, majorApi } from '@/lib/api'
import { reportError } from './error-handling'

export function useIndustryMap() {
  const [map, setMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    industryApi
      .list({ limit: 1000 })
      .then((res) => {
        const nameMap = new Map<string, string>()
        res.items.forEach((item) => {
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
    majorApi
      .list({ limit: 1000 })
      .then((res) => {
        const nameMap = new Map<string, string>()
        res.items.forEach((item) => {
          if (item.name) nameMap.set(item.id, item.name)
        })
        setMap(nameMap)
      })
      .catch((err) => reportError(err, { source: '加载专业字典' }))
  }, [])

  return map
}
