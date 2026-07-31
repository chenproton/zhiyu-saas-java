"use client"

import { useEffect } from "react"
import { toast } from "@zhiyu/ui"
import { setGlobalErrorHandler } from "@/lib/api"

export function GlobalApiErrorHandler() {
  useEffect(() => {
    setGlobalErrorHandler((message: string, status: number, _path: string) => {
      if (status === 400) {
        toast({ variant: "destructive", title: "请求参数错误", description: message })
      } else if (status === 403) {
        toast({ variant: "destructive", title: "权限不足", description: message })
      } else if (status === 404) {
        toast({ variant: "destructive", title: "数据不存在", description: message })
      } else if (status === 409) {
        toast({ variant: "destructive", title: "操作冲突", description: message })
      } else if (status >= 500) {
        toast({ variant: "destructive", title: "服务器错误", description: message })
      } else {
        toast({ variant: "destructive", title: "请求失败", description: message })
      }
    })
    return () => setGlobalErrorHandler(null)
  }, [])

  return null
}
