'use client'

import { useEffect } from 'react'
import { toast } from '@zhiyu/ui'
import { setGlobalErrorHandler } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

export function GlobalApiErrorHandler() {
  const t = useT()
  useEffect(() => {
    setGlobalErrorHandler((message: string, status: number, _path: string) => {
      const description = t(message)
      if (status === 400) {
        toast({ variant: 'destructive', title: t('请求参数错误'), description })
      } else if (status === 403) {
        toast({ variant: 'destructive', title: t('权限不足'), description })
      } else if (status === 404) {
        toast({ variant: 'destructive', title: t('数据不存在'), description })
      } else if (status === 409) {
        toast({ variant: 'destructive', title: t('操作冲突'), description })
      } else if (status >= 500) {
        toast({ variant: 'destructive', title: t('服务器错误'), description })
      } else {
        toast({ variant: 'destructive', title: t('请求失败'), description })
      }
    })
    return () => setGlobalErrorHandler(null)
  }, [t])

  return null
}
