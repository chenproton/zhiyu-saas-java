'use client'

import { useEffect } from 'react'
import { toast } from '@zhiyu/ui'
import { setGlobalErrorHandler } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'

export function GlobalApiErrorHandler() {
  const t = useT()
  useEffect(() => {
    setGlobalErrorHandler((message: string, status: number, _path: string, code?: string) => {
      const description = t(message)
      // 优先按后端统一错误码分支（code 不随文案变化漂移）；未带 code 时回退状态码
      if (code === 'not_found' || status === 404) {
        toast({ variant: 'destructive', title: t('数据不存在'), description })
      } else if (code === 'forbidden' || status === 403) {
        toast({ variant: 'destructive', title: t('权限不足'), description })
      } else if (code === 'bad_request' || status === 400) {
        toast({ variant: 'destructive', title: t('请求参数错误'), description })
      } else if (code === 'conflict' || status === 409) {
        toast({ variant: 'destructive', title: t('操作冲突'), description })
      } else if (code === 'ai_not_configured') {
        toast({ variant: 'destructive', title: t('AI 未配置'), description: t('请先在租户信息页完成 AI 配置') })
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
