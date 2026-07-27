"use client"

import { useState, useEffect, useCallback } from "react"

export interface PlatformLink {
  id: string
  name: string
  url: string
  enabled: boolean
}

export interface PlatformLinksData {
  platforms: PlatformLink[]
}

export interface AppModule {
  id: string
  title: string
  desc: string
  href: string
}

export interface AppModulePlatform {
  id: string
  name: string
  modules: AppModule[]
}

export interface AppModulesData {
  platforms: AppModulePlatform[]
}

export function usePlatformLinks() {
  const [data, setData] = useState<PlatformLinksData>({ platforms: [] })
  const [loading, setLoading] = useState(true)

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/platform-links")
      if (res.ok) {
        const json = await res.json()
        const platforms: PlatformLink[] = (json.items || []).map((item: any) => ({
          id: item.platform || item.id,
          name: item.platform || item.id,
          url: item.url || "",
          enabled: item.enabled ?? true,
        }))
        setData({ platforms })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  const getUrl = useCallback(
    (id: string) => {
      return data.platforms.find((p) => p.id === id)?.url || ""
    },
    [data]
  )

  const isEnabled = useCallback(
    (id: string) => {
      return data.platforms.find((p) => p.id === id)?.enabled ?? true
    },
    [data]
  )

  return { data, loading, getUrl, isEnabled, refresh: fetchLinks }
}

export async function savePlatformLinks(data: PlatformLinksData): Promise<boolean> {
  try {
    const res = await fetch("/api/v1/platform-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return res.ok
  } catch (err) {
    return false
  }
}

export function useAppModules() {
  const [data, setData] = useState<AppModulesData>({ platforms: [] })
  const [loading, setLoading] = useState(true)

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/app-modules")
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModules()
  }, [fetchModules])

  const getModules = useCallback(
    (id: string) => {
      return data.platforms.find((p) => p.id === id)?.modules || []
    },
    [data]
  )

  return { data, loading, getModules, refresh: fetchModules }
}

export async function saveAppModules(data: AppModulesData): Promise<boolean> {
  try {
    const res = await fetch("/api/v1/app-modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return res.ok
  } catch (err) {
    return false
  }
}
