'use client'

import { useState, useEffect } from 'react'
import { industryApi, majorApi } from '@/lib/api'

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
      .catch(() => {})
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
      .catch(() => {})
  }, [])

  return map
}
